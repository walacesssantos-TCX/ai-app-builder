import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { devServerManager } from '../services/dev-server-manager.js'

const startSchema = z.object({
  projectPath: z.string().min(1),
  command: z.string().optional(),
})

export function registerPreviewRoutes(fastify: FastifyInstance): void {
  fastify.post('/preview/start', async (req, reply) => {
    const { projectPath, command } = startSchema.parse(req.body)
    try {
      const info = await devServerManager.start(projectPath, command)
      return info
    } catch (err) {
      reply.status(500)
      return { error: (err as Error).message }
    }
  })

  fastify.post('/preview/stop', async (req) => {
    const { projectPath } = req.body as { projectPath: string }
    if (!projectPath) {
      return { error: 'projectPath is required' }
    }
    const stopped = devServerManager.stop(projectPath)
    return { stopped }
  })

  fastify.get('/preview/status', async (req) => {
    const projectPath = (req.query as { projectPath?: string }).projectPath
    if (projectPath) {
      const info = devServerManager.getStatus(projectPath)
      return { server: info }
    }
    return { servers: devServerManager.getAllStatuses() }
  })

  fastify.get('/preview/events', async (req, reply) => {
    const projectPath = (req.query as { projectPath: string }).projectPath
    if (!projectPath) {
      reply.status(400)
      return { error: 'projectPath query parameter is required' }
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.write('data: {"type":"connected"}\n\n')

    const unsub = devServerManager.subscribe(projectPath, (event) => {
      try { reply.raw.write(`data: ${JSON.stringify(event)}\n\n`) } catch {}
    })

    const heartbeat = setInterval(() => {
      try { reply.raw.write(': heartbeat\n\n') } catch {}
    }, 15000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      unsub()
    })
  })

  fastify.post('/preview/detect', async (req) => {
    const { projectPath } = req.body as { projectPath: string }
    if (!projectPath) {
      return { error: 'projectPath is required' }
    }

    const port = await detectRunningServer(projectPath)
    return { port }
  })
}

const PORT_MAP: Record<string, number[]> = {
  'vite.config': [5173, 5174, 1420],
  'next.config': [3000],
  'nuxt.config': [3000],
  'angular.json': [4200],
  'vue.config': [8080],
  'webpack.config': [8080],
  'serve.json': [5000],
  'package.json': [3000, 5173, 5174, 8080, 1420],
}

const COMMON_PORTS = [1420, 3000, 5173, 5174, 8080, 3001]

async function detectRunningServer(projectPath: string): Promise<number | null> {
  let preferredPorts = COMMON_PORTS

  try {
    const files = ['package.json', 'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs']
    for (const file of files) {
      try {
        const content = readFileSync(resolve(projectPath, file), 'utf-8')
        if (content.includes('tauri')) {
          preferredPorts = [1420]
          break
        }
        if (content.includes('next')) {
          preferredPorts = [3000]
          break
        }
      } catch {}
    }
  } catch {}

  for (const port of preferredPorts) {
    try {
      const res = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(800),
      })
      if (res.ok || res.status === 404) {
        return port
      }
    } catch {
      continue
    }
  }

  for (const port of COMMON_PORTS) {
    if (preferredPorts.includes(port)) continue
    try {
      const res = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(400),
      })
      if (res.ok || res.status === 404) return port
    } catch {
      continue
    }
  }

  return null
}
