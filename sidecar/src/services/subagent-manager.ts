import { buildContext, type BuildContextInput } from './context-builder.js'
import { LLMGateway, type LLMMessage } from './llm-gateway.js'
import { mcpManager } from './mcp-manager.js'
import type { AgentTool, ToolDef, AgentEvent } from './agent-engine.js'
import { execSync } from 'child_process'
import { readFile, writeFile, readdir } from 'fs/promises'
import { prisma } from '../lib/prisma.js'

export interface SubagentDefinition {
  name: string
  description: string
  systemPrompt: string
  allowedTools: string[]
  model?: string
  isBuiltin: boolean
}

interface RunSubagentInput {
  gateway: LLMGateway
  message: string
  history: Array<{ role: string; content: string }>
  activeSkills: Array<{ name: string; description: string; content: string; priority: number; tools?: ToolDef[] }>
  tools: AgentTool[]
  customTools?: ToolDef[]
  requestConfirmation: (command: string) => Promise<boolean>
  model?: string
}

type SubagentEvent = AgentEvent & { subagent?: string }

const BUILTIN_SUBAGENTS: SubagentDefinition[] = [
  {
    name: 'revisor',
    description: 'Revisão de código — analisa bugs, segurança, más práticas e sugere melhorias',
    systemPrompt: `Você é um revisor de código experiente. Analise o código fornecido e identifique:
1. Bugs e erros lógicos
2. Vulnerabilidades de segurança
3. Más práticas e code smells
4. Oportunidades de melhoria (performance, legibilidade, manutenibilidade)
5. Violações de estilo e convenções

Forneça uma revisão estruturada com seções claras. Seja específico: aponte arquivos, linhas e trechos.
Se não encontrar problemas relevantes, informe que o código está satisfatório.`,
    allowedTools: ['read_file', 'search_files', 'list_dir'],
    isBuiltin: true,
  },
  {
    name: 'planejador',
    description: 'Planejamento estratégico — cria planos detalhados com etapas, riscos e dependências',
    systemPrompt: `Você é um planejador estratégico. Analise a tarefa fornecida e crie um plano detalhado.

O plano deve conter:
1. **Objetivo** — O que será feito
2. **Pré-requisitos** — O que já existe ou precisa ser verificado
3. **Etapas** — Lista numerada com ações específicas para cada passo
4. **Riscos** — Possíveis problemas e como mitigá-los
5. **Critérios de sucesso** — Como saber se a tarefa foi concluída

Seja acionável e específico. Evite generalizações.`,
    allowedTools: [],
    isBuiltin: true,
  },
  {
    name: 'pesquisador',
    description: 'Pesquisa no código — explora a base de código para encontrar informações relevantes',
    systemPrompt: `Você é um pesquisador de código. Use as ferramentas de leitura e busca para explorar a base de código.

Sua missão:
1. Encontre arquivos, funções, classes e padrões relevantes para a tarefa
2. Leia e analise o conteúdo encontrado
3. Identifique relações entre componentes
4. Reporte descobertas de forma organizada

Sempre cite arquivos e linhas específicas. Seja minucioso.`,
    allowedTools: ['read_file', 'search_files', 'list_dir'],
    isBuiltin: true,
  },
  {
    name: 'executor',
    description: 'Execução técnica — implementa planos usando ferramentas de arquivo e comando',
    systemPrompt: `Você é um executor técnico. Receba um plano e implemente-o usando as ferramentas disponíveis.

Regras:
1. Siga o plano rigorosamente
2. Escreva código completo e funcional
3. Execute comandos quando necessário
4. Verifique o resultado de cada passo antes de prosseguir
5. Reporte o que foi feito, incluindo arquivos criados/modificados e comandos executados

Tenha cuidado com operações destrutivas. Confirme antes de ações irreversíveis.`,
    allowedTools: ['read_file', 'write_file', 'run_command', 'list_dir', 'search_files'],
    isBuiltin: true,
  },
]

function createSubagentTools(allowedNames: string[], allTools: AgentTool[]): AgentTool[] {
  if (allowedNames.length === 0) return []
  return allTools.filter(t => allowedNames.includes(t.name))
}

const MAX_SUBAGENT_ITERATIONS = 10

export class SubagentManager {
  private customSubagents: Map<string, SubagentDefinition> = new Map()

  listSubagents(): SubagentDefinition[] {
    return [...BUILTIN_SUBAGENTS, ...Array.from(this.customSubagents.values())]
  }

  getSubagent(name: string): SubagentDefinition | undefined {
    return (
      BUILTIN_SUBAGENTS.find(s => s.name === name) ??
      this.customSubagents.get(name)
    )
  }

  async createCustom(def: Omit<SubagentDefinition, 'isBuiltin'>): Promise<SubagentDefinition> {
    const full: SubagentDefinition = { ...def, isBuiltin: false }
    await prisma.userMemory.upsert({
      where: { key: `subagent:${def.name}` },
      update: { value: JSON.stringify(def) },
      create: { key: `subagent:${def.name}`, value: JSON.stringify(def) },
    })
    this.customSubagents.set(def.name, full)
    return full
  }

  async updateCustom(name: string, def: Partial<Omit<SubagentDefinition, 'name' | 'isBuiltin'>>): Promise<SubagentDefinition | undefined> {
    const existing = this.customSubagents.get(name)
    if (!existing) return undefined
    const updated: SubagentDefinition = { ...existing, ...def, isBuiltin: false }
    await prisma.userMemory.upsert({
      where: { key: `subagent:${name}` },
      update: { value: JSON.stringify(updated) },
      create: { key: `subagent:${name}`, value: JSON.stringify(updated) },
    })
    this.customSubagents.set(name, updated)
    return updated
  }

  async deleteCustom(name: string): Promise<boolean> {
    const existing = this.customSubagents.get(name)
    if (!existing) return false
    await prisma.userMemory.delete({ where: { key: `subagent:${name}` } })
    this.customSubagents.delete(name)
    return true
  }

  async loadCustom(): Promise<void> {
    const rows = await prisma.userMemory.findMany({
      where: { key: { startsWith: 'subagent:' } },
    })
    for (const row of rows) {
      try {
        const def = JSON.parse(row.value) as Omit<SubagentDefinition, 'isBuiltin'>
        this.customSubagents.set(def.name, { ...def, isBuiltin: false })
      } catch {
        // skip malformed entries
      }
    }
  }

  async *runSubagent(
    name: string,
    task: string,
    input: RunSubagentInput,
  ): AsyncGenerator<SubagentEvent> {
    const def = this.getSubagent(name)
    if (!def) {
      yield { type: 'subagent_result', subagent: name, result: `Subagente "${name}" não encontrado.` }
      return
    }

    const subTools = createSubagentTools(def.allowedTools, input.tools)
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

    const mcpFiltered: AgentTool[] = def.allowedTools.length === 0
      ? []
      : mcpTools.filter(t => def.allowedTools.some(at => t.name.startsWith(`mcp_${at}`) || t.name === at))

    const customAgentTools: AgentTool[] = (input.customTools || []).map(def => ({
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
          return output.slice(0, 5000)
        } catch (e: unknown) {
          const err = e as { stdout?: string; stderr?: string; message?: string }
          return (err.stdout || err.stderr || err.message || 'Tool failed').slice(0, 5000)
        }
      },
    }))

    const tools: AgentTool[] = [...subTools, ...mcpFiltered, ...customAgentTools]

    const ctx = await buildContext({
      message: task,
      history: input.history,
      activeSkills: input.activeSkills,
    }, def.systemPrompt)

    const messages: LLMMessage[] = [
      { role: 'user', content: task },
      ...ctx.messages,
    ]

    let iteration = 0

    while (iteration < MAX_SUBAGENT_ITERATIONS) {
      iteration++

      yield { type: 'thinking', subagent: name, content: `Iteração ${iteration}` }

      const fullMessages: LLMMessage[] = [
        { role: 'system', content: ctx.systemPrompt },
        ...messages,
      ]

      let response = ''
      for await (const chunk of input.gateway.stream({
        messages: fullMessages,
        model: def.model || input.model || 'llama-3.3-70b-versatile',
        stream: true,
        systemPrompt: ctx.systemPrompt,
      })) {
        response += chunk
      }

      const toolMatch = response.match(/<tool_use>\s*(\w+)\s*\n([\s\S]*?)\n<\/tool_use>/)

      if (!toolMatch) {
        yield { type: 'message', subagent: name, content: response }
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
        yield { type: 'message', subagent: name, content: `Ferramenta desconhecida: ${toolName}. ${response}` }
        return
      }

      yield { type: 'tool_call', subagent: name, tool: toolName, params }

      const command = (params.command as string) || ''
      if (requiresConfirmation(command)) {
        const confirmed = await input.requestConfirmation(command)
        if (!confirmed) {
          const result = 'Usuário rejeitou a execução do comando.'
          yield { type: 'tool_result', subagent: name, result }
          messages.push({ role: 'user' as const, content: `[Tool ${toolName} result: ${result}]` })
          continue
        }
      }

      const result = await tool.execute(params)

      yield { type: 'tool_result', subagent: name, result }

      messages.push({ role: 'user' as const, content: `[Tool ${toolName} result: ${result}]` })
    }

    yield { type: 'message', subagent: name, content: 'Número máximo de iterações atingido.' }
  }
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

export const subagentManager = new SubagentManager()
