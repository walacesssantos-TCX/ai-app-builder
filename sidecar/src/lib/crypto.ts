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
  const computer = process.env.COMPUTERNAME || 'unknown'
  const os = platform()
  const architecture = process.arch
  const user = process.env.USERNAME || 'unknown'
  const raw = `${computer}|${os}|${architecture}|${user}`
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
