import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

let _ffmpegPath: string | null = null
let _ffmpegAvailable: boolean | null = null

function resolveFfmpegPath(): string | null {
  if (_ffmpegPath) return _ffmpegPath
  try {
    const p = _require('ffmpeg-static') as string
    if (p && existsSync(p)) {
      _ffmpegPath = p
      return p
    }
  } catch {}
  const inPath = findInPath()
  if (inPath) {
    _ffmpegPath = inPath
    return inPath
  }
  return null
}

function findInPath(): string | null {
  const dirs = (process.env.PATH || '').split(';')
  for (const dir of dirs) {
    const candidate = dir.trim() + '\\ffmpeg.exe'
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function getFfmpegPath(): string | null {
  return resolveFfmpegPath()
}

export function isFfmpegAvailable(): boolean {
  if (_ffmpegAvailable !== null) return _ffmpegAvailable
  const path = resolveFfmpegPath()
  if (!path) {
    _ffmpegAvailable = false
    return false
  }
  try {
    execSync(`"${path}" -version`, { timeout: 5000, stdio: 'pipe' })
    _ffmpegAvailable = true
  } catch {
    _ffmpegAvailable = false
  }
  return _ffmpegAvailable
}

export function ensureFfmpegInPath(): void {
  const path = resolveFfmpegPath()
  if (!path) return
  const dir = path.substring(0, path.lastIndexOf('\\'))
  const currentPath = process.env.PATH || ''
  if (!currentPath.split(';').some(p => p.toLowerCase() === dir.toLowerCase())) {
    process.env.PATH = `${dir};${currentPath}`
  }
}

function resolveFfprobePath(): string | null {
  const ffmpeg = resolveFfmpegPath()
  if (!ffmpeg) return null
  const dir = ffmpeg.substring(0, ffmpeg.lastIndexOf('\\'))
  const probe = `${dir}\\ffprobe.exe`
  if (existsSync(probe)) return probe
  return null
}

export function getAudioDurationSeconds(audioPath: string): number | null {
  const probe = resolveFfprobePath()
  if (!probe) return null
  try {
    const out = execSync(
      `"${probe}" -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { timeout: 10_000, stdio: 'pipe', encoding: 'utf-8' }
    ).toString().trim()
    const secs = parseFloat(out)
    return isFinite(secs) && secs > 0 ? secs : null
  } catch {
    return null
  }
}
