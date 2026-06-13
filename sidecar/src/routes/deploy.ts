import type { FastifyInstance } from 'fastify'
import { listDeployments, createDeployment, runBuild, updateDeploymentStatus, deleteDeployment } from '../services/deploy.js'

export function registerDeployRoutes(fastify: FastifyInstance): void {
  fastify.get('/deployments', async () => {
    return listDeployments()
  })

  fastify.post('/deployments', async (req, reply) => {
    const { name, projectPath, platform, branch } = req.body as {
      name: string
      projectPath: string
      platform?: string
      branch?: string
    }
    if (!name || !projectPath) {
      return reply.status(400).send({ error: 'name and projectPath are required' })
    }
    return createDeployment({ name, projectPath, platform: platform || 'vercel', branch })
  })

  fastify.post('/deployments/:id/build', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { prisma } = await import('../lib/prisma.js')
    const dep = await prisma.deployment.findUnique({ where: { id } })
    if (!dep) return reply.status(404).send({ error: 'Deployment not found' })

    await updateDeploymentStatus(id, 'building')
    const result = await runBuild(dep.projectPath)
    const newStatus = result.success ? 'built' : 'error'
    await updateDeploymentStatus(id, newStatus, dep.url || undefined, result.log)

    return { success: result.success, log: result.log, status: newStatus }
  })

  fastify.delete('/deployments/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { prisma } = await import('../lib/prisma.js')
    const dep = await prisma.deployment.findUnique({ where: { id } })
    if (!dep) return reply.status(404).send({ error: 'Deployment not found' })
    await deleteDeployment(id)
    return { deleted: true }
  })
}
