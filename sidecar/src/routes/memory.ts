import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const setSchema = z.object({
  value: z.string(),
})

export function registerMemoryRoutes(fastify: FastifyInstance): void {
  fastify.get('/memory/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      reply.code(404)
      return { error: 'Memory key not found' }
    }
    return { key: memory.key, value: memory.value, updatedAt: memory.updatedAt.toISOString() }
  })

  fastify.put('/memory/:key', async (req) => {
    const { key } = req.params as { key: string }
    const parsed = setSchema.parse(req.body)
    const memory = await prisma.userMemory.upsert({
      where: { key },
      create: { key, value: parsed.value },
      update: { value: parsed.value },
    })
    return { key: memory.key, value: memory.value, updatedAt: memory.updatedAt.toISOString() }
  })
}
