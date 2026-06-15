import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { platform } from 'node:os'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'fluxcodex-hwid-salt-v1'

function deriveKey(hwid: string): Buffer {
  return createHash('sha256')
    .update(hwid + SALT)
    .digest()
}

let _key: Buffer | null = null

export function setHwid(hwid: string): void {
  _key = deriveKey(hwid)
}

export function generateHwid(): string {
  // Must match src-tauri/src/commands/filesystem.rs get_hwid() exactly
  const hostname = process.env.COMPUTERNAME || process.env.HOSTNAME || ''
  const osMap: Record<string, string> = { win32: 'windows', darwin: 'macos' }
  const os = osMap[platform()] || platform()
  const archMap: Record<string, string> = { x64: 'x86_64', x32: 'x86', arm64: 'aarch64' }
  const arch = archMap[process.arch] || process.arch
  const username = process.env.USERNAME || process.env.USER || ''
  const raw = `${hostname}|${os}|${arch}|${username}`
  return createHash('sha256').update(raw).digest('hex')
}

function getKey(): Buffer {
  if (!_key) {
    // Fallback for environments without HWID
    return createHash('sha256')
      .update('fluxcodex-default-key-fallback' + SALT)
      .digest()
  }
  return _key
}

export function encryptKey(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptKey(ciphertext: string): string {
  const data = Buffer.from(ciphertext, 'base64')
  const iv = data.subarray(0, 16)
  const authTag = data.subarray(16, 32)
  const encrypted = data.subarray(32)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
