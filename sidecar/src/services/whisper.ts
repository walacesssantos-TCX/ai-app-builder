import { execFile, execSync } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { ensureFfmpegInPath, isFfmpegAvailable, getAudioDurationSeconds } from './ffmpeg.js'


const PYTHON = process.env.WHISPER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')

const TRANSCRIBE_SCRIPT_SRC = `#!/usr/bin/env python3
import argparse, json, sys, time

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='tiny')
    parser.add_argument('--device', default='cpu')
    parser.add_argument('--compute-type', default='int8')
    parser.add_argument('--audio-path', required=True)
    parser.add_argument('--language')
    parser.add_argument('--beam-size', type=int, default=5)
    parser.add_argument('--best-of', type=int, default=5)
    parser.add_argument('--temperature', type=float, default=0.0)
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--condition-on-previous-text', action='store_true', default=True)
    parser.add_argument('--initial-prompt')
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    try:
        print(f'[fw] Loading {args.model} on {args.device} ({args.compute_type})', file=sys.stderr)
        model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    except Exception as e:
        print(f'[fw] CPU fallback: {e}', file=sys.stderr)
        model = WhisperModel(args.model, device='cpu', compute_type='int8')

    print(f'[fw] Transcribing {args.audio_path}...', file=sys.stderr)
    start = time.time()

    kwargs = {
        'beam_size': args.beam_size,
        'best_of': args.best_of,
        'temperature': args.temperature,
        'batch_size': args.batch_size,
        'condition_on_previous_text': args.condition_on_previous_text,
    }
    if args.language:
        kwargs['language'] = args.language
    if args.initial_prompt:
        kwargs['initial_prompt'] = args.initial_prompt

    segments, info = model.transcribe(args.audio_path, **kwargs)
    text_parts = [s.text.strip() for s in segments]

    result = {
        'text': ' '.join(text_parts),
        'language': info.language if info else None,
        'duration_seconds': info.duration if info else None,
        'elapsed_seconds': round(time.time() - start, 2),
    }
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stdout)
        sys.exit(1)
`

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
  turbo: { computeType: 'int8', beamSize: 1, bestOf: 1, temperature: 0, batchSize: 16, initialPrompt: null },
  balanced: { computeType: 'int8', beamSize: 3, bestOf: 3, temperature: 0, batchSize: 8, initialPrompt: null },
  precision: {
    computeType: 'int8', beamSize: 5, bestOf: 5, temperature: 0.0, batchSize: 4,
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
    execSync(`"${PYTHON}" -c "from faster_whisper import WhisperModel; print('ok')"`, { timeout: 10000, stdio: 'pipe', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, shell: true })
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

  if (!isFfmpegAvailable()) {
    throw new Error(
      'ffmpeg não encontrado. Instale com: sudo apt install ffmpeg (Linux) ou winget install ffmpeg (Windows) ou brew install ffmpeg (macOS)'
    )
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'whisper-'))
  const audioPath = join(tmpDir, fileName)
  const scriptPath = join(tmpDir, 'faster_whisper_transcribe.py')
  const startTime = Date.now()

  const modelFactors: Record<string, number> = { tiny: 1, base: 2, small: 4, medium: 8, large: 16, turbo: 1.5 }
  const factor = modelFactors[model] ?? 4

  try {
    await writeFile(audioPath, audioBuffer)
    await writeFile(scriptPath, TRANSCRIBE_SCRIPT_SRC)

    ensureFfmpegInPath()

    const audioDuration = getAudioDurationSeconds(audioPath)
    const dynamicTimeout = audioDuration
      ? Math.min(Math.max(Math.round(audioDuration * factor * 6 * 1000), 300_000), 7_200_000)
      : 1_800_000

    const args = [
      scriptPath,
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
      `[whisper] mode=${mode} model=${model} duration=${audioDuration ?? '?'}s timeout=${(dynamicTimeout / 1000).toFixed(0)}s\n`
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

    let text = ''
    try {
      const parsed = JSON.parse(stdoutText)
      if (parsed.error) throw new Error(parsed.error)
      text = parsed.text || ''
    } catch (parseErr) {
      throw new Error(
        `Não foi possível ler a saída da transcrição. Log:\n${stderrLog.slice(0, 1000)}`
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
      await unlink(audioPath).catch(() => {})
      await unlink(scriptPath).catch(() => {})
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
