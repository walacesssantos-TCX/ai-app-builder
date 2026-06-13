import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { encryptKey } from '../lib/crypto.js'

const PROVIDERS = ['anthropic', 'openai', 'openrouter', 'groq', 'gemini', 'deepseek', 'mistral'] as const

const createSchema = z.object({
  provider: z.enum(PROVIDERS),
  name: z.string().min(1),
  key: z.string().min(1),
})

const updateSchema = z.object({
  provider: z.enum(PROVIDERS).optional(),
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
})

export function registerApiKeyRoutes(fastify: FastifyInstance, gateway: any, reloadGateway: () => Promise<void>): void {
  fastify.get('/api-keys', async () => {
    const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
    return keys.map(k => ({
      id: k.id,
      provider: k.provider,
      name: k.name,
      keyHash: k.keyHash.slice(0, 8) + '...',
      createdAt: k.createdAt.toISOString(),
    }))
  })

  fastify.post('/api-keys', async (req, reply) => {
    const parsed = createSchema.parse(req.body)
    const keyHash = encryptKey(parsed.key)
    const apiKey = await prisma.apiKey.create({
      data: {
        provider: parsed.provider,
        name: parsed.name,
        keyHash,
      },
    })
    await reloadGateway()
    reply.code(201)
    return {
      id: apiKey.id,
      provider: apiKey.provider,
      name: apiKey.name,
      createdAt: apiKey.createdAt.toISOString(),
    }
  })

  fastify.put('/api-keys/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.parse(req.body)
    const data: Record<string, string> = {}
    if (parsed.provider) data.provider = parsed.provider
    if (parsed.name) data.name = parsed.name
    if (parsed.key) data.keyHash = encryptKey(parsed.key)
    const updated = await prisma.apiKey.update({ where: { id }, data })
    await reloadGateway()
    return {
      id: updated.id,
      provider: updated.provider,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
    }
  })

  fastify.delete('/api-keys/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.apiKey.delete({ where: { id } })
    await reloadGateway()
    reply.code(204)
    return
  })
}
