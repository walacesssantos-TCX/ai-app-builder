import type { FileEntry } from '@/types'

async function tauri(): Promise<typeof import('./tauri')> {
  return import('./tauri')
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const mockFs = new Map<string, string>()
const mockDirs = new Set<string>(['/'])

function mockListDir(path: string): FileEntry[] {
  const entries: FileEntry[] = []
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '') || '/'

  for (const key of mockDirs) {
    if (key === normalized) continue
    const parent = key.substring(0, key.lastIndexOf('/')) || '/'
    if (parent === normalized) {
      entries.push({ name: key.split('/').pop() || '', path: key, isDir: true })
    }
  }

  for (const key of mockFs.keys()) {
    const parent = key.substring(0, key.lastIndexOf('/')) || '/'
    if (parent === normalized) {
      entries.push({ name: key.split('/').pop() || '', path: key, isDir: false })
    }
  }

  return entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return b.isDir ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

export async function readFile(path: string): Promise<string> {
  if (isTauri()) return (await tauri()).readFile(path)
  const content = mockFs.get(path)
  if (content === undefined) throw new Error(`File not found: ${path}`)
  return content
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (isTauri()) { await (await tauri()).writeFile(path, content); return }
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/$/, '') || '/'
  const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) || '/'
  await createDirectory(dir)
  mockFs.set(normalizedPath, content)
}

export async function deleteFile(path: string): Promise<void> {
  if (isTauri()) { await (await tauri()).deleteFile(path); return }
  mockFs.delete(path)
  mockDirs.delete(path)
}

export async function listDir(path: string): Promise<FileEntry[]> {
  if (isTauri()) return (await tauri()).listDir(path)
  return mockListDir(path)
}

export async function getFileTree(path: string): Promise<string> {
  if (isTauri()) return (await tauri()).getFileTree(path)
  return mockListDir(path).map(e => `${e.isDir ? '📁' : '📄'} ${e.name}`).join('\n')
}

export async function createDirectory(path: string): Promise<void> {
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '') || '/'
  const parts = normalized.split('/')
  let acc = ''
  for (const part of parts) {
    if (!part) continue
    acc += '/' + part
    mockDirs.add(acc)
  }
}
