import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { execSync } from 'child_process'
import { readFile, writeFile, readdir } from 'fs/promises'
import { getCurrentGateway } from '../services/llm-gateway.js'
import { buildContext } from '../services/context-builder.js'
import { runAgent } from '../services/agent-engine.js'
import { scoreSkills } from '../services/skill-scorer.js'
import * as github from '../services/github.js'
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

const fileSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  content: z.string(),
})

const chatSchema = z.object({
  message: z.string().min(1),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  mode: z.enum(['chat', 'agent', 'think']).default('chat'),
  model: z.string().optional(),
  activeSkills: z.array(activeSkillSchema).optional(),
  availableSkills: z.array(z.object({ name: z.string(), description: z.string(), priority: z.number() })).optional(),
  pinnedSkills: z.array(z.string()).optional(),
  files: z.array(fileSchema).optional(),
})

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

function createTools(projectPath?: string): AgentTool[] {
  const tools: AgentTool[] = [
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

  // GitHub tools (only if authenticated)
  if (github.isAuthenticated()) {
    tools.push({
      name: 'github_list_repos',
      description: 'List GitHub repositories for the authenticated user',
      execute: async () => {
        const repos = await github.listRepos()
        return repos.map(r => `${r.full_name} (${r.private ? 'private' : 'public'})`).join('\n')
      },
    })

    tools.push({
      name: 'github_list_branches',
      description: 'List branches in a GitHub repository. Params: owner, repo',
      execute: async (params) => {
        const owner = params.owner as string
        const repo = params.repo as string
        if (!owner || !repo) return 'Error: owner and repo are required'
        const branches = await github.listBranches(owner, repo)
        return branches.map(b => b.name).join('\n')
      },
    })

    tools.push({
      name: 'github_list_pull_requests',
      description: 'List pull requests in a GitHub repository. Params: owner, repo, state (open/closed/all)',
      execute: async (params) => {
        const owner = params.owner as string
        const repo = params.repo as string
        if (!owner || !repo) return 'Error: owner and repo are required'
        const prs = await github.listPullRequests(owner, repo, (params.state as any) || 'open')
        return prs.map(p => `#${p.number} [${p.state}] ${p.title} — @${p.user.login}`).join('\n')
      },
    })

    tools.push({
      name: 'github_create_pull_request',
      description: 'Create a pull request. Params: owner, repo, title, head, base, body (optional)',
      execute: async (params) => {
        const { owner, repo, title, head, base, body } = params as Record<string, string>
        if (!owner || !repo || !title || !head || !base) return 'Error: owner, repo, title, head, base required'
        const pr = await github.createPullRequest(owner, repo, title, head, base, body)
        return `PR #${pr.number} created: ${pr.html_url}`
      },
    })

    tools.push({
      name: 'github_list_issues',
      description: 'List issues in a GitHub repository. Params: owner, repo, state (open/closed/all)',
      execute: async (params) => {
        const owner = params.owner as string
        const repo = params.repo as string
        if (!owner || !repo) return 'Error: owner and repo are required'
        const issues = await github.listIssues(owner, repo, (params.state as any) || 'open')
        return issues.map(i => `#${i.number} [${i.state}] ${i.title} — ${i.comments} comments`).join('\n')
      },
    })

    tools.push({
      name: 'github_create_issue',
      description: 'Create an issue. Params: owner, repo, title, body (optional), labels (comma-separated, optional)',
      execute: async (params) => {
        const { owner, repo, title, body, labels } = params as Record<string, string>
        if (!owner || !repo || !title) return 'Error: owner, repo, title required'
        const labelsArr = labels ? labels.split(',').map(l => l.trim()) : undefined
        const issue = await github.createIssue(owner, repo, title, body, labelsArr)
        return `Issue #${issue.number} created: ${issue.html_url}`
      },
    })
  }

  return tools
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

export function registerChatRoutes(fastify: FastifyInstance, _gateway?: unknown): void {
  fastify.post('/chat', async (req, reply) => {
    const parsed = chatSchema.parse(req.body)
    let { message, mode, activeSkills, projectId, availableSkills, pinnedSkills, files } = parsed

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')

    const model = parsed.model || 'llama-3.3-70b-versatile'
    let ctx: Awaited<ReturnType<typeof buildContext>>
    let totalInput = 0
    let totalOutput = 0

    try {
      ctx = await Promise.race([
        buildContext({
          message,
          history: [],
          activeSkills: activeSkills || [],
          projectPath: projectId,
          files: files || [],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('buildContext excedeu o limite de 15s')), 15_000)
        ),
      ])

      // Auto-trigger de skills (Spec §4.2) — inside try-catch to avoid hanging
      if (availableSkills && availableSkills.length > 0 && (!activeSkills || activeSkills.length === 0)) {
        const { selected } = await scoreSkills(
          message,
          availableSkills.map(s => ({ name: s.name, description: s.description, priority: s.priority })),
          pinnedSkills || [],
          3,
          getCurrentGateway()
        )

        if (selected.length > 0 && (!activeSkills || activeSkills.length === 0)) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'skill_auto_trigger', skills: selected })}\n\n`)
        }

        reply.raw.write(`data: ${JSON.stringify({ type: 'active_skills', skills: selected })}\n\n`)
      }

      if (mode === 'agent') {
        const tools = createTools(projectId ? undefined : undefined)

        const customTools: ToolDef[] = (activeSkills || [])
          .flatMap(s => s.tools || [])

        for await (const event of runAgent({
          gateway: getCurrentGateway(),
          tools,
          customTools: customTools.length > 0 ? customTools : undefined,
          input: {
            message,
            history: [],
            activeSkills: activeSkills || [],
            files: files || [],
          },
          onEvent: () => {},
          requestConfirmation: async (command: string) => !requiresConfirmation(command),
          model,
        })) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        }
      } else {
        const systemPrompt = mode === 'think' ? buildThinkPrompt(ctx.systemPrompt) : ctx.systemPrompt

        reply.raw.write(`data: ${JSON.stringify({ type: 'system_prompt', length: systemPrompt.length })}\n\n`)

        for await (const chunk of getCurrentGateway().stream({
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
      const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')
      if (isQuotaError) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'message', content: `Cota do provedor exaurida (429). O modelo atual não pode processar mensagens no momento. Acesse Configurações > API Keys para configurar outro provedor (OpenAI, Anthropic, Groq) ou aguarde a cota resetar.` })}\n\n`)
      } else {
        reply.raw.write(`data: ${JSON.stringify({ type: 'message', content: `Erro: ${errorMessage}` })}\n\n`)
      }
    }

    reply.raw.write('data: [DONE]\n\n')
    reply.raw.end()
  })

  // Model Comparison — send same prompt to multiple models in parallel
  fastify.post('/chat/compare', async (req, reply) => {
    const { prompt, models, systemPrompt } = req.body as {
      prompt: string
      models: string[]
      systemPrompt?: string
    }
    if (!prompt || !Array.isArray(models) || models.length === 0) {
      return reply.status(400).send({ error: 'prompt and models are required' })
    }

    const results = await Promise.allSettled(
      models.map(async (model) => {
        const chunks: string[] = []
        for await (const chunk of getCurrentGateway().stream({
          messages: [{ role: 'user', content: prompt }],
          model,
          stream: true,
          systemPrompt,
        })) {
          chunks.push(chunk)
        }
        return { model, content: chunks.join('') }
      })
    )

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      return { model: models[i], content: '', error: r.reason?.message || 'Unknown error' }
    })
  })
}
