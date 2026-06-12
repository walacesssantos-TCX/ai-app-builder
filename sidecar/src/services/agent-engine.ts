import { buildContext, type BuildContextInput } from './context-builder.js'
import { LLMGateway, type LLMMessage } from './llm-gateway.js'

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

interface AgentEvent {
  type: 'thinking' | 'message' | 'tool_call' | 'tool_result'
  content?: string
  tool?: string
  params?: unknown
  result?: string
}

interface AgentContext {
  gateway: LLMGateway
  tools: AgentTool[]
  input: BuildContextInput
  onEvent: (event: AgentEvent) => void
  requestConfirmation: (command: string) => Promise<boolean>
  model?: string
}

const MAX_ITERATIONS = 50

export async function* runAgent(context: AgentContext): AsyncGenerator<AgentEvent> {
  const { gateway, tools, input, onEvent, requestConfirmation } = context

  const ctx = await buildContext(input)
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = ctx.messages.map(m => ({ role: m.role, content: m.content }))

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
      model: context.model || 'llama3-70b-8192',
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
