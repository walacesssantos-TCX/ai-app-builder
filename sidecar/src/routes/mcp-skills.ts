import type { FastifyInstance } from 'fastify'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..')
const SKILLS_CANDIDATES = [
  join(PROJECT_ROOT, 'memoria de conversa', 'skills'),
  join(PROJECT_ROOT, 'ai-app-builder', 'src-tauri', 'resources', 'skills'),
]

interface SkillEntry {
  name: string
  description: string
  content: string
}

async function loadSkills(): Promise<SkillEntry[]> {
  for (const dir of SKILLS_CANDIDATES) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const skills: SkillEntry[] = []

      for (const entry of entries) {
        const filePath = join(dir, entry.name)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = await readFile(filePath, 'utf-8')
          const parsed = parseSkillMd(content)
          if (parsed) skills.push(parsed)
        } else if (entry.isDirectory()) {
          try {
            const skillContent = await readFile(join(filePath, 'SKILL.md'), 'utf-8')
            const parsed = parseSkillMd(skillContent)
            if (parsed) skills.push(parsed)
          } catch {
            // no SKILL.md in subdirectory
          }
        }
      }

      if (skills.length > 0) return skills
    } catch {
      continue
    }
  }
  return []
}

function parseSkillMd(content: string): SkillEntry | null {
  const parts = content.split('---')
  if (parts.length < 3) return null

  const frontmatterLines = parts[1].trim().split('\n')
  const name = extractField(frontmatterLines, 'name')
  const description = extractField(frontmatterLines, 'description') || ''
  const body = parts.slice(2).join('---').trim()

  if (!name) return null

  return { name, description, content: body }
}

function extractField(lines: string[], key: string): string | null {
  const prefix = `${key}: `
  for (const line of lines) {
    if (line.trim().startsWith(prefix)) {
      return line.trim().slice(prefix.length).replace(/^["']|["']$/g, '')
    }
  }
  return null
}

export function registerMcpSkillsRoutes(fastify: FastifyInstance): void {
  let skillsCache: SkillEntry[] = []
  let lastLoad = 0

  async function getSkills(): Promise<SkillEntry[]> {
    const now = Date.now()
    if (now - lastLoad > 10_000) {
      skillsCache = await loadSkills()
      lastLoad = now
    }
    return skillsCache
  }

  fastify.post('/mcp-skills', async (req, reply) => {
    const body = req.body as {
      jsonrpc: string
      id: string
      method: string
      params?: { name?: string; arguments?: Record<string, unknown> }
    }

    if (!body || body.jsonrpc !== '2.0') {
      return reply.code(400).send({
        jsonrpc: '2.0',
        id: body?.id || null,
        error: { code: -32600, message: 'Invalid Request' },
      })
    }

    const { id, method, params } = body

    try {
      const skills = await getSkills()

      if (method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'list_skills',
                description: 'Lista todas as skills disponíveis no ecossistema Fluxcodex',
                inputSchema: {
                  type: 'object',
                  properties: {
                    filter: {
                      type: 'string',
                      description: 'Filtro opcional por nome ou descrição',
                    },
                  },
                },
              },
              {
                name: 'read_skill',
                description: 'Lê o conteúdo completo de uma skill pelo nome',
                inputSchema: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Nome da skill',
                    },
                  },
                  required: ['name'],
                },
              },
              {
                name: 'search_skills',
                description: 'Busca skills por palavra-chave no nome, descrição ou conteúdo',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Termo de busca',
                    },
                  },
                  required: ['query'],
                },
              },
            ],
          },
        }
      }

      if (method === 'tools/call') {
        const toolName = params?.name || ''
        const toolArgs = (params?.arguments || {}) as Record<string, unknown>

        if (toolName === 'list_skills') {
          const filter = (toolArgs.filter as string) || ''
          const filtered = filter
            ? skills.filter(s =>
                s.name.toLowerCase().includes(filter.toLowerCase()) ||
                s.description.toLowerCase().includes(filter.toLowerCase())
              )
            : skills

          const text = filtered.map(s =>
            `  \u2022 ${s.name}\n    ${s.description}`
          ).join('\n')

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: text
                    ? `## Skills disponíveis (${filtered.length})\n\n${text}`
                    : 'Nenhuma skill encontrada.',
                },
              ],
            },
          }
        }

        if (toolName === 'read_skill') {
          const skillName = (toolArgs.name as string) || ''
          const skill = skills.find(s => s.name.toLowerCase() === skillName.toLowerCase())

          if (!skill) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32000, message: `Skill '${skillName}' não encontrada` },
            }
          }

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `# ${skill.name}\n\n${skill.description}\n\n---\n\n${skill.content}`,
                },
              ],
            },
          }
        }

        if (toolName === 'search_skills') {
          const query = ((toolArgs.query as string) || '').toLowerCase()
          if (!query) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32000, message: 'query é obrigatório' },
            }
          }

          const results = skills.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query) ||
            s.content.toLowerCase().includes(query)
          )

          const text = results.map(s =>
            `  \u2022 **${s.name}** — ${s.description}`
          ).join('\n')

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: text
                    ? `## Resultados para "${query}" (${results.length})\n\n${text}`
                    : `Nenhum resultado para "${query}".`,
                },
              ],
            },
          }
        }

        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        }
      }

      if (method === 'resources/list') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: skills.map(s => ({
              uri: `skills:///${s.name}`,
              name: s.name,
              description: s.description,
              mimeType: 'text/markdown',
            })),
          },
        }
      }

      if (method === 'resources/read') {
        const resourceParams = params as { uri?: string } | undefined
        const uri = resourceParams?.uri || ''
        const skillName = uri.replace('skills:///', '')
        const skill = skills.find(s => s.name === skillName)

        if (!skill) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: `Resource not found: ${uri}` },
          }
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: `# ${skill.name}\n\n${skill.description}\n\n---\n\n${skill.content}`,
              },
            ],
          },
        }
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: `Internal error: ${(err as Error).message}` },
      }
    }
  })
}
