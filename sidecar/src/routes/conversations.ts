import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const createConversationSchema = z.object({
  title: z.string().optional(),
  model: z.string().default('claude-sonnet-4-20250514'),
  mode: z.enum(['chat', 'agent', 'think']).default('chat'),
})

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1),
  metadata: z.string().optional(),
})

export function registerConversationRoutes(fastify: FastifyInstance): void {
  fastify.get('/projects/:projectId/conversations', async (req) => {
    const { projectId } = req.params as { projectId: string }
    const conversations = await prisma.conversation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    })
    return conversations.map(c => ({
      id: c.id,
      projectId: c.projectId,
      title: c.title,
      model: c.model,
      mode: c.mode,
      messageCount: c._count.messages,
      createdAt: c.createdAt.toISOString(),
    }))
  })

  fastify.post('/projects/:projectId/conversations', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const parsed = createConversationSchema.parse(req.body)
    const conversation = await prisma.conversation.create({
      data: {
        projectId,
        title: parsed.title,
        model: parsed.model,
        mode: parsed.mode,
      },
    })
    reply.code(201)
    return {
      id: conversation.id,
      projectId: conversation.projectId,
      title: conversation.title,
      model: conversation.model,
      mode: conversation.mode,
      createdAt: conversation.createdAt.toISOString(),
    }
  })

  fastify.get('/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!conversation) {
      reply.code(404)
      return { error: 'Conversation not found' }
    }
    return {
      id: conversation.id,
      projectId: conversation.projectId,
      title: conversation.title,
      model: conversation.model,
      mode: conversation.mode,
      createdAt: conversation.createdAt.toISOString(),
      messages: conversation.messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    }
  })

  fastify.delete('/conversations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.message.deleteMany({ where: { conversationId: id } })
    await prisma.conversation.delete({ where: { id } })
    reply.code(204)
    return
  })

  fastify.get('/conversations/:id/messages', async (req) => {
    const { id } = req.params as { id: string }
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    })
    return messages.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString(),
    }))
  })

  fastify.post('/conversations/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = createMessageSchema.parse(req.body)
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role: parsed.role,
        content: parsed.content,
        metadata: parsed.metadata,
      },
    })
    reply.code(201)
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    }
  })
}
