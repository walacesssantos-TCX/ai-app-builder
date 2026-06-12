import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { execSync } from 'child_process'
import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import { LLMGateway } from '../services/llm-gateway.js'
import { buildContext } from '../services/context-builder.js'
import { runAgent } from '../services/agent-engine.js'
import type { AgentTool, ToolDef } from '../services/agent-engine.js'

const toolDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  exec: z.string(),
  permissions: z.array(z.string()),
})

const activeSkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  content: z.string(),
  priority: z.number(),
  tools: z.array(toolDefSchema).optional(),
})

const chatSchema = z.object({
  message: z.string().min(1),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  mode: z.enum(['chat', 'agent', 'think']).default('chat'),
  model: z.string().optional(),
  activeSkills: z.array(activeSkillSchema).optional(),
})

function createTools(projectPath?: string): AgentTool[] {
  return [
    {
      name: 'read_file',
      description: 'Read a file from disk',
      execute: async (params: Record<string, unknown>) => {
        const path = params.path as string
        if (!path) return 'Error: path is required'
        try {
          const content = await readFile(path, 'utf-8')
          return content
        } catch (e) {
          return `Error reading file: ${e}`
        }
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      execute: async (params: Record<string, unknown>) => {
        const path = params.path as string
        const content = params.content as string
        if (!path || content === undefined) return 'Error: path and content are required'
        try {
          await writeFile(path, content, 'utf-8')
          return `File written: ${path}`
        } catch (e) {
          return `Error writing file: ${e}`
        }
      },
    },
    {
      name: 'run_command',
      description: 'Execute a shell command (PowerShell on Windows)',
      execute: async (params: Record<string, unknown>) => {
        const command = params.command as string
        if (!command) return 'Error: command is required'
        try {
          const output = execSync(command, {
            encoding: 'utf-8',
            timeout: 30000,
            cwd: projectPath || undefined,
          })
          return output.slice(0, 5000)
        } catch (e: unknown) {
          const err = e as { stdout?: string; stderr?: string; message?: string }
          return (err.stdout || err.stderr || err.message || 'Command failed').slice(0, 5000)
        }
      },
    },
    {
      name: 'list_dir',
      description: 'List files in a directory',
      execute: async (params: Record<string, unknown>) => {
        const path = (params.path as string) || projectPath || '.'
        try {
          const entries = await readdir(path, { withFileTypes: true })
          return entries
            .map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`)
            .join('\n')
        } catch (e) {
          return `Error listing directory: ${e}`
        }
      },
    },
    {
      name: 'search_files',
      description: 'Search for text in files (uses findstr on Windows)',
      execute: async (params: Record<string, unknown>) => {
        const pattern = params.pattern as string
        const path = (params.path as string) || projectPath || '.'
        if (!pattern) return 'Error: pattern is required'
        try {
          const output = execSync(
            `findstr /s /n /i "${pattern}" "${path}\\*"`,
            { encoding: 'utf-8', timeout: 15000 }
          )
          return output.slice(0, 5000)
        } catch {
          return 'No matches found or search error'
        }
      },
    },
  ]
}

function buildThinkPrompt(basePrompt: string): string {
  return basePrompt + `\n\n## Modo Think (Raciocínio Estendido)

Você está no modo THINK. Antes de responder, siga estas etapas obrigatoriamente:

1. **Analise o problema** — Identifique os requisitos, restrições e objetivos da pergunta.
2. **Explore alternativas** — Considere múltiplas abordagens antes de escolher uma.
3. **Raciocine passo a passo** — Use pensamento estruturado com etapas claras.
4. **Verifique** — Revise sua resposta para erros antes de finalizar.

Formate sua resposta com:
- Uma seção de **análise** (breve)
- Uma seção de **raciocínio** (detalhada, com etapas)
- Uma seção de **resposta final** (direta e concisa)`
}

export function registerChatRoutes(fastify: FastifyInstance, gateway: LLMGateway): void {
  fastify.post('/chat', async (req, reply) => {
    const parsed = chatSchema.parse(req.body)
    const { message, mode, activeSkills, projectId } = parsed

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')

    const ctx = await buildContext({
      message,
      history: [],
      activeSkills: activeSkills || [],
    })

    const model = parsed.model || 'llama3-70b-8192'
    let totalInput = 0
    let totalOutput = 0

    try {
      if (mode === 'agent') {
        const tools = createTools(projectId ? undefined : undefined)

        const customTools: ToolDef[] = (activeSkills || [])
          .flatMap(s => s.tools || [])

        for await (const event of runAgent({
          gateway,
          tools,
          customTools: customTools.length > 0 ? customTools : undefined,
          input: {
            message,
            history: [],
            activeSkills: activeSkills || [],
          },
          onEvent: () => {},
          requestConfirmation: async () => true,
          model,
        })) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        }
      } else {
        const systemPrompt = mode === 'think' ? buildThinkPrompt(ctx.systemPrompt) : ctx.systemPrompt

        for await (const chunk of gateway.stream({
          messages: ctx.messages,
          model,
          stream: true,
          systemPrompt,
          onTokenUsage: (input, output, _total) => {
            totalInput = input
            totalOutput = output
          },
        })) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
        }

        if (totalInput || totalOutput) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'token_usage', input: totalInput, output: totalOutput, total: totalInput + totalOutput })}\n\n`)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      reply.raw.write(`data: ${JSON.stringify({ type: 'message', content: `Erro: ${errorMessage}` })}\n\n`)
    }

    reply.raw.write('data: [DONE]\n\n')
    reply.raw.end()
  })
}
