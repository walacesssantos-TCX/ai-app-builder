import { execFile, execSync } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join, dirname, resolve, extname } from 'path'
import { fileURLToPath } from 'url'
import { ensureFfmpegInPath, isFfmpegAvailable, getAudioDurationSeconds } from './ffmpeg.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCRIPTS_DIR = resolve(__dirname, '..', '..', 'scripts')
const TRANSCRIBE_SCRIPT = join(SCRIPTS_DIR, 'faster_whisper_transcribe.py')

const PYTHON = process.env.WHISPER_PYTHON || 'C:\\Users\\walace\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe'

export type WhisperMode = 'auto' | 'turbo' | 'balanced' | 'precision'

export interface TranscribeOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'turbo'
  language?: string
  mode?: WhisperMode
  batchSize?: number
  outputFormat?: 'txt' | 'vtt' | 'srt' | 'tsv' | 'json'
}

export interface TranscribeResult {
  text: string
  segments: number
  duration: number
  model: string
  language: string
}

let _whisperAvailable: boolean | null = null

function pickModel(bufferSize: number): 'tiny' | 'base' | 'small' {
  const sizeMB = bufferSize / (1024 * 1024)
  if (sizeMB > 50) return 'tiny'
  if (sizeMB > 15) return 'base'
  return 'small'
}

const MODE_PRESETS: Record<Exclude<WhisperMode, 'auto'>, {
  computeType: string; beamSize: number; bestOf: number; temperature: number; batchSize: number
  initialPrompt: string | null
}> = {
  turbo: { computeType: 'float16', beamSize: 1, bestOf: 1, temperature: 0, batchSize: 16, initialPrompt: null },
  balanced: { computeType: 'float16', beamSize: 3, bestOf: 3, temperature: 0, batchSize: 8, initialPrompt: null },
  precision: {
    computeType: 'float16', beamSize: 5, bestOf: 5, temperature: 0.0, batchSize: 4,
    initialPrompt: 'Abaixo está uma transcrição precisa em português, respeitando siglas, nomes próprios e pontuação.',
  },
}

function expandMode(mode: WhisperMode | undefined, model: string) {
  if (!mode || mode === 'auto') {
    const smallModels = ['tiny', 'base', 'turbo']
    return smallModels.includes(model) ? MODE_PRESETS.turbo : MODE_PRESETS.balanced
  }
  return MODE_PRESETS[mode]
}

export async function isWhisperAvailable(): Promise<boolean> {
  if (_whisperAvailable !== null) return _whisperAvailable
  try {
    execSync(`"${PYTHON}" -c "from faster_whisper import WhisperModel; print('ok')"`, { timeout: 10000, stdio: 'pipe', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    const ff = isFfmpegAvailable()
    _whisperAvailable = ff
    if (!ff) {
      process.stderr.write('[whisper] faster-whisper disponível, mas ffmpeg não encontrado\n')
    }
  } catch {
    _whisperAvailable = false
  }
  return _whisperAvailable
}

export async function transcribeBuffer(
  audioBuffer: Buffer,
  fileName: string,
  options?: TranscribeOptions
): Promise<TranscribeResult> {
  const model = options?.model || process.env.WHISPER_MODEL || pickModel(audioBuffer.length)
  const mode: WhisperMode = options?.mode || 'auto'
  const preset = expandMode(mode, model)

  const ffmpegOk = isFfmpegAvailable()
  if (!ffmpegOk) {
    throw new Error(
      'ffmpeg não encontrado. O instalador já inclui ffmpeg, mas ele não foi localizado. ' +
      'Tente reinstalar o aplicativo ou instale manualmente: winget install ffmpeg'
    )
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'whisper-'))
  const audioPath = join(tmpDir, fileName)
  const startTime = Date.now()

  const modelFactors: Record<string, number> = { tiny: 1, base: 2, small: 4, medium: 8, large: 16, turbo: 1.5 }
  const factor = modelFactors[model] ?? 4
  const audioDuration = getAudioDurationSeconds(audioPath)

  try {
    await writeFile(audioPath, audioBuffer)

    ensureFfmpegInPath()

    const fastDuration = getAudioDurationSeconds(audioPath)
    const dynamicTimeout = fastDuration
      ? Math.min(Math.max(Math.round(fastDuration * factor * 6 * 1000), 300_000), 7_200_000)
      : 1_800_000

    const args = [
      TRANSCRIBE_SCRIPT,
      '--model', model,
      '--audio-path', audioPath,
      '--compute-type', preset.computeType,
      '--beam-size', String(preset.beamSize),
      '--best-of', String(preset.bestOf),
      '--temperature', String(preset.temperature),
      '--batch-size', String(options?.batchSize ?? preset.batchSize),
    ]

    if (options?.language) {
      args.push('--language', options.language)
    }
    if (preset.initialPrompt) {
      args.push('--initial-prompt', preset.initialPrompt)
    }
    if (preset.beamSize >= 3) {
      args.push('--condition-on-previous-text')
    }

    process.stderr.write(
      `[whisper] mode=${mode} model=${model} duration=${fastDuration ?? '?'}s timeout=${(dynamicTimeout / 1000).toFixed(0)}s\n`
    )

    let stderrLog = ''
    let stdoutText = ''
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        PYTHON,
        args,
        { timeout: dynamicTimeout, maxBuffer: 100 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } },
        (err, stdout) => {
          if (err) {
            const nodeErr = err as NodeJS.ErrnoException & { code?: string | number; signal?: string; killed?: boolean }
            const msg = err instanceof Error ? err.message.toLowerCase() : ''
            if (msg.includes('enoent') || msg.includes('not found') || nodeErr.code === 'ENOENT') {
              reject(new Error('Python não encontrado. Verifique WHISPER_PYTHON.'))
              return
            }
            const exitCode = nodeErr.code ?? 'unknown'
            const signal = nodeErr.signal ?? 'none'
            const killed = nodeErr.killed ?? false
            const timeoutHint = killed && signal === 'SIGTERM'
              ? ` (timeout de ${(dynamicTimeout / 1000 / 60).toFixed(0)}min excedido — áudio muito longo ou PC lento demais para o modelo "${model}")`
              : ''
            reject(new Error(
              `Whisper falhou (exit: ${exitCode}, signal: ${signal}, killed: ${killed})${timeoutHint}. ` +
              `Log:\n${stderrLog.slice(0, 1000)}`
            ))
          } else {
            if (stdout) stdoutText = stdout
            resolve()
          }
        }
      )
      proc.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString()
        stderrLog += line
        process.stderr.write(`[whisper] ${line.trim()}\n`)
      })
    })

    if (stderrLog.toLowerCase().includes('filenotfounderror') || stderrLog.includes('WinError 2')) {
      throw new Error(`Whisper encontrou um erro interno de sistema:\n${stderrLog.slice(0, 500)}`)
    }

    let text = ''
    try {
      const parsed = JSON.parse(stdoutText)
      if (parsed.error) {
        throw new Error(parsed.error)
      }
      text = parsed.text || ''
    } catch (parseErr) {
      throw new Error(
        `Não foi possível ler a saída do transcricão. Log:\n${stderrLog.slice(0, 1000)}`
      )
    }

    const elapsed = (Date.now() - startTime) / 1000
    const segments = text.trim() ? text.trim().split('\n\n').length : 0

    return {
      text: text.trim(),
      segments,
      duration: Math.round(elapsed),
      model,
      language: options?.language || 'auto',
    }
  } finally {
    try {
      if (audioPath) await unlink(audioPath).catch(() => {})
    } catch {}
    await unlink(tmpDir).catch(() => {})
  }
}

export async function transcribeBase64(
  base64Content: string,
  fileName: string,
  options?: TranscribeOptions
): Promise<TranscribeResult> {
  const buffer = Buffer.from(base64Content, 'base64')
  return transcribeBuffer(buffer, fileName, options)
}
