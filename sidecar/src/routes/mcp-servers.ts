import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { mcpManager, type McpServerConfig } from '../services/mcp-manager.js'

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

const callToolSchema = z.object({
  serverId: z.string(),
  toolName: z.string(),
  params: z.unknown().optional(),
})

function serverToConfig(s: { id: string; name: string; transport: string; url?: string | null; command?: string | null; args?: string | null; enabled: boolean }): McpServerConfig {
  return {
    id: s.id,
    name: s.name,
    transport: s.transport as McpServerConfig['transport'],
    url: s.url ?? undefined,
    command: s.command ?? undefined,
    args: s.args ?? undefined,
    enabled: s.enabled,
  }
}

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
    if (server.enabled && mcpManager.isInitialized()) {
      mcpManager.connect(serverToConfig(server)).catch(() => {})
    }
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
    if (server.enabled && mcpManager.isInitialized()) {
      mcpManager.connect(serverToConfig(server)).catch(() => {})
    } else {
      mcpManager.disconnect(id)
    }
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
    mcpManager.disconnect(id)
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
    if (updated.enabled && mcpManager.isInitialized()) {
      mcpManager.connect(serverToConfig(updated)).catch(() => {})
    } else {
      mcpManager.disconnect(id)
    }
    return { enabled: updated.enabled }
  })

  fastify.get('/mcp/status', async () => {
    return mcpManager.getStatus()
  })

  fastify.get('/mcp/servers/:id/status', async (req) => {
    const { id } = req.params as { id: string }
    const status = mcpManager.getServerStatus(id)
    if (!status) return { serverId: id, connected: false, tools: 0 }
    return status
  })

  fastify.get('/mcp/servers/:id/tools', async (req) => {
    const { id } = req.params as { id: string }
    return { tools: mcpManager.getServerTools(id) }
  })

  fastify.get('/mcp/tools', async () => {
    return { tools: mcpManager.getAllTools() }
  })

  fastify.post('/mcp/tools/call', async (req) => {
    const { serverId, toolName, params } = callToolSchema.parse(req.body)
    const result = await mcpManager.callTool(serverId, toolName, params)
    return { result }
  })

  fastify.post('/mcp/servers/:id/reconnect', async (req) => {
    const { id } = req.params as { id: string }
    await mcpManager.reconnect(id)
    return { status: mcpManager.getServerStatus(id) }
  })

  fastify.post('/mcp/test-connection', async (req) => {
    const parsed = createSchema.parse(req.body)
    const result = await mcpManager.testConnection(serverToConfig(parsed as typeof parsed & { id: string; enabled: boolean }))
    return result
  })

  fastify.post('/mcp/refresh-tools', async () => {
    await mcpManager.refreshTools()
    return { tools: mcpManager.getAllTools() }
  })
}
