import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const createSchema = z.object({
  skillPath: z.string().min(1),
  pinned: z.boolean().default(false),
})

export function registerSkillRoutes(fastify: FastifyInstance): void {
  fastify.get('/projects/:projectId/skills', async (req) => {
    const { projectId } = req.params as { projectId: string }
    const skills = await prisma.projectSkill.findMany({
      where: { projectId },
    })
    return skills.map(s => ({
      id: s.id,
      projectId: s.projectId,
      skillPath: s.skillPath,
      pinned: s.pinned,
    }))
  })

  fastify.post('/projects/:projectId/skills', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const parsed = createSchema.parse(req.body)
    const skill = await prisma.projectSkill.create({
      data: {
        projectId,
        skillPath: parsed.skillPath,
        pinned: parsed.pinned,
      },
    })
    reply.code(201)
    return {
      id: skill.id,
      projectId: skill.projectId,
      skillPath: skill.skillPath,
      pinned: skill.pinned,
    }
  })

  fastify.delete('/projects/:projectId/skills/:skillId', async (req, reply) => {
    const { skillId } = req.params as { skillId: string }
    await prisma.projectSkill.delete({ where: { id: skillId } })
    reply.code(204)
    return
  })
}
