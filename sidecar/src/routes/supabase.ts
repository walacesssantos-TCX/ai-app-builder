import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { supabaseManager } from '../services/supabase-manager.js'
import { encryptKey, decryptKey } from '../lib/crypto.js'

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  anonKey: z.string().min(1),
  serviceKey: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  anonKey: z.string().min(1).optional(),
  serviceKey: z.string().optional(),
  enabled: z.boolean().optional(),
})

const querySchema = z.object({
  table: z.string().min(1),
  select: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  order: z.string().optional(),
  ascending: z.boolean().optional(),
})

const sqlSchema = z.object({
  query: z.string().min(1),
})

const storageListSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().optional(),
})

function maskKey(key: string): string {
  if (key.length <= 8) return '***'
  return key.slice(0, 4) + '***' + key.slice(-4)
}

function formatRow(r: { id: string; name: string; url: string; anonKey: string; serviceKey: string | null; enabled: boolean; createdAt: Date }) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    anonKey: maskKey(r.anonKey),
    serviceKey: r.serviceKey ? maskKey(decryptKey(r.serviceKey)) : null,
    hasServiceKey: r.serviceKey !== null,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
  }
}

export function registerSupabaseRoutes(fastify: FastifyInstance): void {
  fastify.get('/supabase', async () => {
    const rows = await prisma.supabaseConnection.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(r => formatRow(r))
  })

  fastify.post('/supabase', async (req, reply) => {
    const data = createSchema.parse(req.body)
    const created = await prisma.supabaseConnection.create({
      data: {
        name: data.name,
        url: data.url,
        anonKey: data.anonKey,
        serviceKey: data.serviceKey ? encryptKey(data.serviceKey) : undefined,
      },
    })

    if (created.enabled) {
      await supabaseManager.connect({
        id: created.id,
        name: created.name,
        url: created.url,
        anonKey: created.anonKey,
        serviceKey: data.serviceKey,
        enabled: created.enabled,
      })
    }

    return formatRow(created)
  })

  fastify.put('/supabase/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = updateSchema.parse(req.body)

    const existing = await prisma.supabaseConnection.findUnique({ where: { id } })
    if (!existing) {
      reply.status(404)
      return { error: 'Conexão não encontrada' }
    }

    const dbData: Record<string, unknown> = { ...data }
    if (data.serviceKey !== undefined) {
      dbData.serviceKey = data.serviceKey ? encryptKey(data.serviceKey) : null
    }

    const updated = await prisma.supabaseConnection.update({
      where: { id },
      data: dbData as any,
    })

    supabaseManager.disconnect(id)
    if (updated.enabled) {
      await supabaseManager.connect({
        id: updated.id,
        name: updated.name,
        url: updated.url,
        anonKey: data.anonKey || existing.anonKey,
        serviceKey: data.serviceKey || (existing.serviceKey ? decryptKey(existing.serviceKey) : undefined),
        enabled: updated.enabled,
      })
    }

    return formatRow(updated)
  })

  fastify.delete('/supabase/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.supabaseConnection.findUnique({ where: { id } })
    if (!existing) {
      reply.status(404)
      return { error: 'Conexão não encontrada' }
    }

    await prisma.supabaseConnection.delete({ where: { id } })
    supabaseManager.disconnect(id)
    return { deleted: true }
  })

  fastify.put('/supabase/:id/toggle', async (req) => {
    const { id } = req.params as { id: string }
    const row = await prisma.supabaseConnection.findUnique({ where: { id } })
    if (!row) return { error: 'Conexão não encontrada' }

    const updated = await prisma.supabaseConnection.update({
      where: { id },
      data: { enabled: !row.enabled },
    })

    if (updated.enabled) {
      await supabaseManager.connect({
        id: updated.id,
        name: updated.name,
        url: updated.url,
        anonKey: updated.anonKey,
        serviceKey: updated.serviceKey ? decryptKey(updated.serviceKey) : undefined,
        enabled: updated.enabled,
      })
    } else {
      supabaseManager.disconnect(id)
    }

    return { enabled: updated.enabled }
  })

  fastify.post('/supabase/test-connection', async (req) => {
    const data = createSchema.parse(req.body)
    const result = await supabaseManager.testConnection(data)
    return result
  })

  fastify.get('/supabase/status', async () => {
    const connections = await prisma.supabaseConnection.findMany()
    const online = supabaseManager.getStatus()
    return connections.map(c => {
      const status = online.find(s => s.id === c.id)
      return {
        id: c.id,
        name: c.name,
        url: c.url,
        enabled: c.enabled,
        connected: status?.connected ?? false,
        error: status?.error,
        project: status?.project,
      }
    })
  })

  fastify.get('/supabase/:id/status', async (req) => {
    const { id } = req.params as { id: string }
    const status = supabaseManager.getConnectionStatus(id)
    if (!status) return { connected: false }
    return status
  })

  fastify.get('/supabase/:id/tables', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const tables = await supabaseManager.listTables(id)
      return { tables }
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.get('/supabase/:id/table-info', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { table } = req.query as { table: string }
    if (!table) {
      reply.status(400)
      return { error: 'table query parameter is required' }
    }
    try {
      const info = await supabaseManager.getTableInfo(id, table)
      return info
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.post('/supabase/:id/query', async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = querySchema.parse(req.body)
    try {
      const result = await supabaseManager.query(id, data.table, {
        select: data.select,
        limit: data.limit,
        offset: data.offset,
        order: data.order,
        ascending: data.ascending,
      })
      return result
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.post('/supabase/:id/sql', async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = sqlSchema.parse(req.body)
    try {
      const result = await supabaseManager.executeSql(id, data.query)
      return { data: result }
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.get('/supabase/:id/buckets', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const buckets = await supabaseManager.listBuckets(id)
      return { buckets }
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.post('/supabase/:id/files', async (req, reply) => {
    const { id } = req.params as { id: string }
    const data = storageListSchema.parse(req.body)
    try {
      const files = await supabaseManager.listFiles(id, data.bucket, data.path)
      return { files }
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.get('/supabase/:id/auth-users', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const users = await supabaseManager.getAuthUsers(id)
      return { users }
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })
}
