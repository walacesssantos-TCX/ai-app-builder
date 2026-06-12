import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const createSchema = z.object({
  name: z.string().min(1),
  transport: z.enum(['stdio', 'http', 'sse', 'ws']),
  url: z.string().optional(),
  command: z.string().optional(),
  args: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  transport: z.enum(['stdio', 'http', 'sse', 'ws']).optional(),
  url: z.string().optional(),
  command: z.string().optional(),
  args: z.string().optional(),
})

export function registerMcpRoutes(fastify: FastifyInstance): void {
  fastify.get('/mcp-servers', async () => {
    const servers = await prisma.mcpServer.findMany({ orderBy: { createdAt: 'desc' } })
    return servers.map(s => ({
      id: s.id,
      name: s.name,
      transport: s.transport,
      url: s.url,
      command: s.command,
      args: s.args,
      enabled: s.enabled,
      createdAt: s.createdAt.toISOString(),
    }))
  })

  fastify.post('/mcp-servers', async (req, reply) => {
    const parsed = createSchema.parse(req.body)
    const server = await prisma.mcpServer.create({ data: parsed })
    reply.code(201)
    return {
      id: server.id,
      name: server.name,
      transport: server.transport,
      url: server.url,
      command: server.command,
      args: server.args,
      enabled: server.enabled,
      createdAt: server.createdAt.toISOString(),
    }
  })

  fastify.put('/mcp-servers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.parse(req.body)
    const server = await prisma.mcpServer.update({ where: { id }, data: parsed })
    return {
      id: server.id,
      name: server.name,
      transport: server.transport,
      url: server.url,
      command: server.command,
      args: server.args,
      enabled: server.enabled,
      createdAt: server.createdAt.toISOString(),
    }
  })

  fastify.delete('/mcp-servers/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.mcpServer.delete({ where: { id } })
    reply.code(204)
    return
  })

  fastify.put('/mcp-servers/:id/toggle', async (req) => {
    const { id } = req.params as { id: string }
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    if (!server) throw new Error('MCP server not found')
    const updated = await prisma.mcpServer.update({
      where: { id },
      data: { enabled: !server.enabled },
    })
    return { enabled: updated.enabled }
  })
}
