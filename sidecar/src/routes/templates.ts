import type { FastifyInstance } from 'fastify'
import { listTemplates, createFromTemplate } from '../services/templates.js'

export function registerTemplateRoutes(fastify: FastifyInstance): void {
  fastify.get('/templates', async () => {
    const templates = await listTemplates()
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      fileCount: t.files.length,
    }))
  })

  fastify.get('/templates/:id', async (req) => {
    const { id } = req.params as { id: string }
    const templates = await listTemplates()
    const template = templates.find(t => t.id === id)
    if (!template) throw new Error('Template not found')
    return template
  })

  fastify.post('/templates/:id/create', async (req) => {
    const { id } = req.params as { id: string }
    const { destPath, replacements } = req.body as { destPath: string; replacements?: Record<string, string> }
    if (!destPath) return { error: 'destPath is required' }
    const result = await createFromTemplate(id, destPath, replacements)
    return result
  })
}
