import { execSync } from 'child_process'

let _ffmpegAvailable: boolean | null = null

export function isFfmpegAvailable(): boolean {
  if (_ffmpegAvailable !== null) return _ffmpegAvailable
  try {
    execSync('ffmpeg -version', { timeout: 5000, stdio: 'pipe' })
    _ffmpegAvailable = true
  } catch {
    _ffmpegAvailable = false
  }
  return _ffmpegAvailable
}

export function getFfmpegPath(): string | null {
  try {
    execSync('ffmpeg -version', { timeout: 5000, stdio: 'pipe' })
    return 'ffmpeg'
  } catch {
    return null
  }
}

export function ensureFfmpegInPath(): void {
}

export function getAudioDurationSeconds(audioPath: string): number | null {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
      { timeout: 10_000, stdio: 'pipe', encoding: 'utf-8' }
    ).toString().trim()
    const secs = parseFloat(out)
    return isFinite(secs) && secs > 0 ? secs : null
  } catch {
    return null
  }
}
