import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { subagentManager } from '../services/subagent-manager.js'
import type { LLMGateway } from '../services/llm-gateway.js'

const createSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_-]*$/, 'Name must start with a letter and contain only lowercase letters, numbers, hyphens and underscores'),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  allowedTools: z.array(z.string()).default([]),
  model: z.string().optional(),
})

const updateSchema = z.object({
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  model: z.string().optional(),
})

export function registerSubagentRoutes(fastify: FastifyInstance, gateway: LLMGateway): void {
  fastify.get('/subagents', async () => {
    return { subagents: subagentManager.listSubagents() }
  })

  fastify.post('/subagents', async (req, reply) => {
    const parsed = createSchema.parse(req.body)
    const existing = subagentManager.getSubagent(parsed.name)
    if (existing) {
      reply.status(409)
      return { error: `Subagente "${parsed.name}" já existe.` }
    }
    const def = await subagentManager.createCustom(parsed)
    return def
  })

  fastify.put('/subagents/:name', async (req, reply) => {
    const { name } = req.params as { name: string }
    const parsed = updateSchema.parse(req.body)
    const updated = await subagentManager.updateCustom(name, parsed)
    if (!updated) {
      reply.status(404)
      return { error: `Subagente "${name}" não encontrado.` }
    }
    return updated
  })

  fastify.delete('/subagents/:name', async (req, reply) => {
    const { name } = req.params as { name: string }
    const deleted = await subagentManager.deleteCustom(name)
    if (!deleted) {
      reply.status(404)
      return { error: `Subagente "${name}" não encontrado.` }
    }
    return { success: true }
  })

  fastify.post('/subagents/:name/run', async (req, reply) => {
    const { name } = req.params as { name: string }
    const { task } = req.body as { task: string }
    if (!task) {
      reply.status(400)
      return { error: 'task is required' }
    }
    const gen = subagentManager.runSubagent(name, task, {
      gateway,
      message: task,
      history: [],
      activeSkills: [],
      tools: [],
      requestConfirmation: async () => false,
    })
    let result = ''
    for await (const event of gen) {
      if (event.type === 'message' && event.content) {
        result = event.content
      }
    }
    return { subagent: name, result }
  })
}
