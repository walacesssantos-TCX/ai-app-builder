import { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { transcribeBase64 } from '../services/whisper.js'
import { generateDocx } from '../services/docx.js'

interface TranscriptionJob {
  jobId: string
  originalFileName: string
  audioBase64?: string
  text?: string
  docxPath?: string
  status: 'pending' | 'processing' | 'done' | 'error'
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

const jobs = new Map<string, TranscriptionJob>()

const JOBS_DIR = path.join(tmpdir(), 'aibuilder-transcribe-jobs')

async function ensureJobsDir() {
  await fs.mkdir(JOBS_DIR, { recursive: true })
}

export function registerTranscribePageRoutes(fastify: FastifyInstance) {
  fastify.post('/transcribe/upload', async (req, reply) => {
    const { file, fileName } = req.body as {
      file: string
      fileName: string
    }

    if (!file || !fileName) {
      return reply.status(400).send({ error: 'file (base64) and fileName are required' })
    }

    const validExts = ['.mp3', '.wav', '.m4a', '.ogg', '.flac']
    const ext = path.extname(fileName).toLowerCase()
    if (!validExts.includes(ext)) {
      return reply.status(400).send({
        error: `Formato não suportado: ${ext}. Use: ${validExts.join(', ')}`,
      })
    }

    await ensureJobsDir()

    const jobId = randomUUID()
    const jobDir = path.join(JOBS_DIR, jobId)
    await fs.mkdir(jobDir, { recursive: true })

    const job: TranscriptionJob = {
      jobId,
      originalFileName: fileName,
      audioBase64: file,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    jobs.set(jobId, job)

    fastify.log.info(`[transcribe-page] Job ${jobId} created for ${fileName}`)

    return {
      jobId,
      fileName,
      status: 'pending',
    }
  })

  fastify.post<{ Params: { jobId: string }; Body: { model?: string; mode?: string } }>('/transcribe/start/:jobId', async (req, reply) => {
    const { jobId } = req.params
    const job = jobs.get(jobId)

    if (!job) {
      return reply.status(404).send({ error: 'Job não encontrado.' })
    }

    if (job.status !== 'pending') {
      return reply.status(409).send({
        error: 'Este job já está em processamento ou foi concluído.',
      })
    }

    job.status = 'processing'

    setImmediate(async () => {
      try {
        fastify.log.info(`[transcribe-page] Starting transcription for job ${jobId}`)

        const mode = (req.body?.mode || 'auto') as 'auto' | 'turbo' | 'balanced' | 'precision'
        const result = await transcribeBase64(job.audioBase64!, job.originalFileName, {
          language: 'pt',
          model: (req.body.model || 'tiny') as 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'turbo',
          mode,
        })

        job.text = result.text

        const title = path.parse(job.originalFileName).name
        const jobDir = path.join(JOBS_DIR, jobId)
        const docxName = `${title}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.docx`
        const docxPath = path.join(jobDir, docxName)

        await generateDocx(result.text, docxPath, {
          title,
          originalFileName: job.originalFileName,
        })

        job.docxPath = docxPath
        job.status = 'done'
        job.completedAt = new Date().toISOString()

        delete job.audioBase64

        fastify.log.info(`[transcribe-page] Job ${jobId} completed`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        fastify.log.error(`[transcribe-page] Job ${jobId} failed: ${message}`)
        job.status = 'error'
        job.errorMessage = message
      }
    })

    return {
      jobId,
      status: 'processing',
      message: 'Transcrição iniciada. Consulte /transcribe/status/{jobId} para acompanhar.',
    }
  })

  fastify.get('/transcribe/status/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = jobs.get(jobId)

    if (!job) {
      return reply.status(404).send({ error: 'Job não encontrado.' })
    }

    return {
      jobId: job.jobId,
      status: job.status,
      originalFileName: job.originalFileName,
      createdAt: job.createdAt,
      completedAt: job.completedAt ?? null,
      errorMessage: job.errorMessage ?? null,
    }
  })

  fastify.get('/transcribe/result/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = jobs.get(jobId)

    if (!job) {
      return reply.status(404).send({ error: 'Job não encontrado.' })
    }

    if (job.status !== 'done') {
      return reply.status(409).send({
        error: `Transcrição ainda não concluída. Status atual: ${job.status}.`,
      })
    }

    return {
      jobId: job.jobId,
      text: job.text ?? '',
      originalFileName: job.originalFileName,
    }
  })

  fastify.get('/transcribe/download/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = jobs.get(jobId)

    if (!job) {
      return reply.status(404).send({ error: 'Job não encontrado.' })
    }

    if (job.status !== 'done' || !job.docxPath) {
      return reply.status(409).send({
        error: `Transcrição ainda não concluída. Status atual: ${job.status}.`,
      })
    }

    try {
      await fs.access(job.docxPath)
    } catch {
      return reply.status(500).send({ error: 'Arquivo .docx não encontrado em disco.' })
    }

    const stream = require('fs').createReadStream(job.docxPath)
    const title = path.parse(job.originalFileName).name
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const downloadName = `${title}_${dateStr}.docx`

    reply.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    reply.header('Content-Disposition', `attachment; filename="${downloadName}"`)
    return reply.send(stream)
  })
}
