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
