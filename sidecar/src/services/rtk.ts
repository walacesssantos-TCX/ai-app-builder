import { execFile } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

const RTK_BIN = process.env.RTK_PATH || 'rtk'

let _available: boolean | null = null

export async function isRtkAvailable(): Promise<boolean> {
  if (_available !== null) return _available
  try {
    await execFileAsync(RTK_BIN, ['--version'])
    _available = true
  } catch {
    _available = false
  }
  return _available
}

export async function compressText(text: string, level: 'minimal' | 'aggressive' = 'aggressive'): Promise<string> {
  if (!text || text.length < 200) return text

  const tmpFile = join(tmpdir(), `rtk-${randomUUID()}.tmp`)
  try {
    await writeFile(tmpFile, text, 'utf-8')
    const { stdout } = await execFileAsync(RTK_BIN, ['read', `--level=${level}`, tmpFile], {
      maxBuffer: 10 * 1024 * 1024,
    })
    return stdout.trim() || text
  } catch {
    return text
  } finally {
    unlink(tmpFile).catch(() => {})
  }
}

let _savedTokens = 0

export function getSavedTokens(): number {
  return _savedTokens
}

export function trackSaved(original: string, compressed: string): void {
  const saved = Math.round((original.length - compressed.length) * 0.25)
  if (saved > 0) _savedTokens += saved
}
