import { execSync } from 'child_process'
import { buildContext, type BuildContextInput } from './context-builder.js'
import { LLMGateway, type LLMMessage } from './llm-gateway.js'
import { mcpManager } from './mcp-manager.js'
import { subagentManager } from './subagent-manager.js'

export interface ToolDef {
  name: string
  description: string
  exec: string
  permissions: string[]
}

export interface AgentTool {
  name: string
  description: string
  execute: (params: Record<string, unknown>) => Promise<string>
}

const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /Remove-Item.*-Recurse.*-Force/i,
  /format\s+[a-z]:/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /--force-with-lease/i,
]

function requiresConfirmation(command: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(command))
}

export type AgentEventType = 'thinking' | 'message' | 'tool_call' | 'tool_result' | 'subagent_task' | 'subagent_event' | 'subagent_result'

export interface AgentEvent {
  type: AgentEventType
  content?: string
  tool?: string
  params?: unknown
  result?: string
  subagent?: string
}

interface AgentContext {
  gateway: LLMGateway
  tools: AgentTool[]
  input: BuildContextInput
  onEvent: (event: AgentEvent) => void
  requestConfirmation: (command: string) => Promise<boolean>
  model?: string
  customTools?: ToolDef[]
}

function createCustomTools(toolDefs: ToolDef[]): AgentTool[] {
  return toolDefs.map(def => ({
    name: def.name,
    description: def.description,
    execute: async (params: Record<string, unknown>) => {
      const cwd = (params.cwd as string) || process.cwd()
      const isWin = process.platform === 'win32'
      const envPrefix = Object.entries(params)
        .filter(([k]) => k !== 'cwd')
        .map(([k, v]) => isWin
          ? `set "TOOL_${k.toUpperCase()}=${String(v ?? '')}" &&`
          : `TOOL_${k.toUpperCase()}='${String(v ?? '')}' `
        )
        .join('')
      const command = isWin ? `${envPrefix} ${def.exec}` : `${envPrefix}${def.exec}`
      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          timeout: 30000,
          cwd,
          shell: isWin ? 'cmd.exe' : true,
        })
        return String(output).slice(0, 5000)
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message?: string }
        return (err.stdout || err.stderr || err.message || 'Tool failed').slice(0, 5000)
      }
    },
  }))
}

const MAX_ITERATIONS = 50

export async function* runAgent(context: AgentContext): AsyncGenerator<AgentEvent> {
  const { gateway, tools: builtinTools, input, onEvent, requestConfirmation, customTools } = context

  const mcpTools: AgentTool[] = mcpManager.getAllTools().map(mcpTool => ({
    name: `mcp_${mcpTool.serverName.replace(/[^a-zA-Z0-9]/g, '_')}_${mcpTool.tool.name}`,
    description: `[MCP: ${mcpTool.serverName}] ${mcpTool.tool.description} — Server ID: ${mcpTool.serverId}`,
    execute: async (params: Record<string, unknown>) => {
      try {
        const result = await mcpManager.callTool(mcpTool.serverId, mcpTool.tool.name, params)
        return JSON.stringify(result, null, 2).slice(0, 10000)
      } catch (err) {
        return `MCP tool error: ${(err as Error).message}`
      }
    },
  }))

  const subagents = subagentManager.listSubagents()
  const subagentDescriptions = subagents.map(s =>
    `- \`${s.name}\`: ${s.description} (ferramentas: ${s.allowedTools.length > 0 ? s.allowedTools.join(', ') : 'nenhuma'})`
  ).join('\n')

  const spawnSubagentTool: AgentTool = {
    name: 'spawn_subagent',
    description: `Delega uma tarefa a um subagente especializado. Subagentes disponíveis:\n${subagentDescriptions}\n\nUse params: { "name": "nome_do_subagente", "task": "descrição detalhada da tarefa" }`,
    execute: async () => 'Use o mecanismo interno de subagentes através do loop principal.',
  }

  const tools = customTools?.length
    ? [...builtinTools, spawnSubagentTool, ...mcpTools, ...createCustomTools(customTools)]
    : [...builtinTools, spawnSubagentTool, ...mcpTools]

  const ctx = await buildContext(input)
  const messages: Array<LLMMessage> = ctx.messages.map(m => ({ role: m.role, content: m.content }))

  let iteration = 0

  while (iteration < MAX_ITERATIONS) {
    iteration++

    yield { type: 'thinking', content: `Iteração ${iteration} — analisando...` }
    onEvent({ type: 'thinking', content: `Iteração ${iteration}` })

    const fullMessages: LLMMessage[] = [
      { role: 'system', content: ctx.systemPrompt },
      ...messages,
    ]

    let response = ''
    for await (const chunk of gateway.stream({
      messages: fullMessages,
      model: context.model || 'llama-3.3-70b-versatile',
      stream: true,
      systemPrompt: ctx.systemPrompt,
    })) {
      response += chunk
    }

    const toolMatch = response.match(/<tool_use>\s*(\w+)\s*\n([\s\S]*?)\n<\/tool_use>/)

    if (!toolMatch) {
      yield { type: 'message', content: response }
      return
    }

    const toolName = toolMatch[1].trim()
    let params: Record<string, unknown> = {}

    try {
      params = JSON.parse(toolMatch[2].trim())
    } catch {
      params = { content: toolMatch[2].trim() }
    }

    if (toolName === 'spawn_subagent') {
      const { name: subName, task } = params as { name?: string; task?: string }

      if (!subName || !task) {
        yield { type: 'message', content: 'spawn_subagent requer params: { name: string, task: string }' }
        return
      }

      yield { type: 'subagent_task', subagent: subName, content: task }
      onEvent({ type: 'subagent_task', subagent: subName, content: task })

      let result = ''
      for await (const subEvent of subagentManager.runSubagent(subName, task, {
        gateway,
        message: task,
        history: input.history,
        activeSkills: input.activeSkills,
        tools: builtinTools,
        customTools,
        requestConfirmation,
        model: context.model,
      })) {
        const enriched = { ...subEvent, subagent: subName }
        yield enriched as AgentEvent
        onEvent(enriched as AgentEvent)
        if (subEvent.type === 'message' && subEvent.content) {
          result = subEvent.content
        }
      }

      yield { type: 'subagent_result', subagent: subName, result }
      onEvent({ type: 'subagent_result', subagent: subName, result })

      messages.push({ role: 'user', content: `[Subagent "${subName}" result: ${result}]` })
      continue
    }

    const tool = tools.find(t => t.name === toolName)
    if (!tool) {
      yield { type: 'message', content: `Ferramenta desconhecida: ${toolName}. ${response}` }
      return
    }

    yield { type: 'tool_call', tool: toolName, params }
    onEvent({ type: 'tool_call', tool: toolName, params })

    const command = (params.command as string) || ''
    if (requiresConfirmation(command)) {
      const confirmed = await requestConfirmation(command)
      if (!confirmed) {
        const result = 'Usuário rejeitou a execução do comando.'
        yield { type: 'tool_result', result }
        onEvent({ type: 'tool_result', result })
        messages.push({ role: 'user', content: `[Tool ${toolName} result: ${result}]` })
        continue
      }
    }

    const result = await tool.execute(params)

    yield { type: 'tool_result', result }
    onEvent({ type: 'tool_result', result })

    messages.push({ role: 'user', content: `[Tool ${toolName} result: ${result}]` })
  }

  yield { type: 'message', content: 'Número máximo de iterações atingido.' }
}
