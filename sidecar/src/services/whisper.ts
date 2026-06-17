import { execFile, execSync } from 'child_process'
import { writeFile, unlink, readFile, mkdtemp, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'


const PYTHON = process.env.WHISPER_PYTHON || 'C:\\Users\\walace\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe'

export interface TranscribeOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'turbo'
  language?: string
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

export async function isWhisperAvailable(): Promise<boolean> {
  if (_whisperAvailable !== null) return _whisperAvailable
  try {
    execSync(`"${PYTHON}" -c "import whisper; print(whisper.__version__)"`, { timeout: 5000, stdio: 'pipe' })
    _whisperAvailable = true
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
  const model = options?.model || process.env.WHISPER_MODEL || 'medium'
  const tmpDir = await mkdtemp(join(tmpdir(), 'whisper-'))
  const audioPath = join(tmpDir, fileName)
  const startTime = Date.now()

  try {
    await writeFile(audioPath, audioBuffer)

    const args = ['-m', 'whisper', audioPath, '--model', model, '--output_dir', tmpDir, '--output_format', 'txt']

    if (options?.language) {
      args.push('--language', options.language)
    }

    let stderrLog = ''
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(PYTHON, args, { timeout: 600_000, maxBuffer: 100 * 1024 * 1024 }, (err) => {
        if (err) {
          const msg = err instanceof Error ? err.message.toLowerCase() : ''
          if (msg.includes('enoent') || msg.includes('not found') || (err as { code?: string }).code === 'ENOENT') {
            reject(new Error('Python não encontrado. Verifique WHISPER_PYTHON.'))
          } else {
            reject(new Error(`Whisper falhou: ${err.message}. Log:\n${stderrLog.slice(0, 1000)}`))
          }
        } else {
          resolve()
        }
      })
      proc.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString()
        stderrLog += line
        process.stderr.write(`[whisper] ${line.trim()}\n`)
      })
    })

    if (stderrLog.toLowerCase().includes('filenotfounderror') || stderrLog.includes('WinError 2')) {
      if (stderrLog.includes('load_audio') || stderrLog.includes('ffmpeg')) {
        throw new Error('ffmpeg não encontrado. Instale ffmpeg (winget install ffmpeg) e tente novamente.')
      }
      throw new Error(`Whisper encontrou um erro interno:\n${stderrLog.slice(0, 500)}`)
    }

    const files = await readdir(tmpDir)
    const outFile = files.find(f => f !== fileName && !f.startsWith('part_'))
    let text = ''
    if (outFile) {
      text = await readFile(join(tmpDir, outFile), 'utf-8')
    } else {
      const txtPath = audioPath.replace(/\.[^.]+$/, '.txt')
      try {
        text = await readFile(txtPath, 'utf-8')
      } catch {
        const modelTxtPath = join(tmpDir, `${fileName.replace(/\.[^.]+$/, '')}.txt`)
        try {
          text = await readFile(modelTxtPath, 'utf-8')
        } catch {
          throw new Error(
            `Whisper não gerou arquivo de saída. Log do Whisper:\n${stderrLog.slice(0, 1000)}`
          )
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000
    const segments = text.trim() ? text.trim().split('\n\n').length : 0

    return {
      text: text.trim(),
      segments,
      duration: Math.round(duration),
      model,
      language: options?.language || 'auto',
    }
  } finally {
    try {
      const files = await readdir(tmpDir)
      for (const f of files) {
        unlink(join(tmpDir, f)).catch(() => {})
      }
    } catch {}
    unlink(tmpDir).catch(() => {})
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
