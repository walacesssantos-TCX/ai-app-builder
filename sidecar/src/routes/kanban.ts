import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

function makeKey(projectPath: string): string {
  return `kanban:${projectPath}`
}

export function registerKanbanRoutes(fastify: FastifyInstance): void {
  fastify.get('/kanban/:projectPath', async (req, reply) => {
    const { projectPath } = req.params as { projectPath: string }
    const key = makeKey(projectPath)
    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      return { board: null }
    }
    return { board: JSON.parse(memory.value) }
  })

  fastify.put('/kanban/:projectPath', async (req) => {
    const { projectPath } = req.params as { projectPath: string }
    const key = makeKey(projectPath)

    const existing = await prisma.userMemory.findUnique({ where: { key } })
    const current = existing ? JSON.parse(existing.value) : { columns: [], cards: [] }

    const body = req.body as Record<string, unknown>
    const merged = { ...current, ...body }

    await prisma.userMemory.upsert({
      where: { key },
      create: { key, value: JSON.stringify(merged) },
      update: { value: JSON.stringify(merged) },
    })

    return { board: merged }
  })

  fastify.post('/kanban/:projectPath/columns', async (req, reply) => {
    const { projectPath } = req.params as { projectPath: string }
    const { title, color } = req.body as { title: string; color?: string }
    if (!title) {
      reply.status(400)
      return { error: 'title is required' }
    }
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    const data = memory ? JSON.parse(memory.value) : { columns: [], cards: [] }
    if (!data.columns) data.columns = []

    const newColumn = {
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      color: color || 'zinc',
    }
    data.columns.push(newColumn)

    await prisma.userMemory.upsert({
      where: { key },
      create: { key, value: JSON.stringify(data) },
      update: { value: JSON.stringify(data) },
    })

    return { column: newColumn }
  })

  fastify.put('/kanban/:projectPath/columns/:columnId', async (req, reply) => {
    const { projectPath, columnId } = req.params as { projectPath: string; columnId: string }
    const { title, color } = req.body as { title?: string; color?: string }
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      reply.status(404)
      return { error: 'Board not found' }
    }

    const data = JSON.parse(memory.value)
    const col = data.columns?.find((c: any) => c.id === columnId)
    if (!col) {
      reply.status(404)
      return { error: 'Column not found' }
    }

    if (title !== undefined) col.title = title
    if (color !== undefined) col.color = color

    await prisma.userMemory.update({ where: { key }, data: { value: JSON.stringify(data) } })
    return { column: col }
  })

  fastify.delete('/kanban/:projectPath/columns/:columnId', async (req, reply) => {
    const { projectPath, columnId } = req.params as { projectPath: string; columnId: string }
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      reply.status(404)
      return { error: 'Board not found' }
    }

    const data = JSON.parse(memory.value)
    data.columns = (data.columns || []).filter((c: any) => c.id !== columnId)
    data.cards = (data.cards || []).filter((c: any) => c.columnId !== columnId)

    await prisma.userMemory.update({ where: { key }, data: { value: JSON.stringify(data) } })
    return { deleted: true }
  })

  fastify.post('/kanban/:projectPath/cards', async (req, reply) => {
    const { projectPath } = req.params as { projectPath: string }
    const { title, columnId, description, priority, labels } = req.body as {
      title: string; columnId: string; description?: string; priority?: string; labels?: string[]
    }
    if (!title || !columnId) {
      reply.status(400)
      return { error: 'title and columnId are required' }
    }
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    const data = memory ? JSON.parse(memory.value) : { columns: [], cards: [] }
    if (!data.cards) data.cards = []

    const cardsInColumn = data.cards.filter((c: any) => c.columnId === columnId)
    const newCard = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      description: description || '',
      columnId,
      position: cardsInColumn.length,
      priority: priority || 'medium',
      labels: labels || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    data.cards.push(newCard)

    await prisma.userMemory.upsert({
      where: { key },
      create: { key, value: JSON.stringify(data) },
      update: { value: JSON.stringify(data) },
    })

    return { card: newCard }
  })

  fastify.put('/kanban/:projectPath/cards/:cardId', async (req, reply) => {
    const { projectPath, cardId } = req.params as { projectPath: string; cardId: string }
    const updates = req.body as Record<string, unknown>
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      reply.status(404)
      return { error: 'Board not found' }
    }

    const data = JSON.parse(memory.value)
    const card = data.cards?.find((c: any) => c.id === cardId)
    if (!card) {
      reply.status(404)
      return { error: 'Card not found' }
    }

    for (const [k, v] of Object.entries(updates)) {
      if (k !== 'id') card[k] = v
    }
    card.updatedAt = new Date().toISOString()

    await prisma.userMemory.update({ where: { key }, data: { value: JSON.stringify(data) } })
    return { card }
  })

  fastify.delete('/kanban/:projectPath/cards/:cardId', async (req, reply) => {
    const { projectPath, cardId } = req.params as { projectPath: string; cardId: string }
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      reply.status(404)
      return { error: 'Board not found' }
    }

    const data = JSON.parse(memory.value)
    data.cards = (data.cards || []).filter((c: any) => c.id !== cardId)
    await prisma.userMemory.update({ where: { key }, data: { value: JSON.stringify(data) } })
    return { deleted: true }
  })

  fastify.put('/kanban/:projectPath/reorder', async (req, reply) => {
    const { projectPath } = req.params as { projectPath: string }
    const { cards } = req.body as { cards: { id: string; columnId: string; position: number }[] }
    const key = makeKey(projectPath)

    const memory = await prisma.userMemory.findUnique({ where: { key } })
    if (!memory) {
      reply.status(404)
      return { error: 'Board not found' }
    }

    const data = JSON.parse(memory.value)
    for (const update of cards) {
      const card = data.cards?.find((c: any) => c.id === update.id)
      if (card) {
        card.columnId = update.columnId
        card.position = update.position
        card.updatedAt = new Date().toISOString()
      }
    }

    await prisma.userMemory.update({ where: { key }, data: { value: JSON.stringify(data) } })
    return { success: true }
  })
}
