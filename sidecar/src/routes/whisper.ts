import { FastifyInstance } from 'fastify'
import { transcribeBase64, isWhisperAvailable } from '../services/whisper.js'

export function registerWhisperRoutes(fastify: FastifyInstance) {
  fastify.post('/whisper/transcribe', async (req, reply) => {
    const { file, fileName, model, language } = req.body as {
      file: string
      fileName: string
      model?: string
      language?: string
    }

    if (!file || !fileName) {
      return reply.status(400).send({ error: 'file and fileName are required' })
    }

    try {
      const result = await transcribeBase64(file, fileName, {
        model: model as any,
        language,
      })
      return { success: true, ...result }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      fastify.log.error(`[whisper] Transcription failed: ${message}`)
      return reply.status(500).send({ error: 'Transcription failed', message })
    }
  })

  fastify.get('/whisper/status', async () => ({
    available: await isWhisperAvailable(),
    python: process.env.WHISPER_PYTHON || 'default',
  }))
}
