import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const createSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  description: z.string().optional(),
})

export function registerProjectRoutes(fastify: FastifyInstance): void {
  fastify.get('/projects', async () => {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { conversations: true } } },
    })
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      description: p.description,
      conversationCount: p._count.conversations,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  })

  fastify.post('/projects', async (req, reply) => {
    const parsed = createSchema.parse(req.body)
    const project = await prisma.project.create({
      data: {
        name: parsed.name,
        path: parsed.path,
        description: parsed.description,
      },
    })
    reply.code(201)
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }
  })

  fastify.get('/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const project = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { conversations: true } } },
    })
    if (!project) {
      reply.code(404)
      return { error: 'Project not found' }
    }
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      description: project.description,
      conversationCount: project._count.conversations,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }
  })

  fastify.put('/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.parse(req.body)
    const project = await prisma.project.update({ where: { id }, data: parsed })
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }
  })

  fastify.delete('/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.project.delete({ where: { id } })
    reply.code(204)
    return
  })
}
