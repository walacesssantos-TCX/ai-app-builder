import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { access, mkdtemp, open, readdir, stat, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const execFileAsync = promisify(execFile)

const DEFAULT_BASE_URL = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
const DEFAULT_MODEL_NAME = 'fluxcodex-qwen35-native'

let ollamaProcess: ChildProcess | null = null

function baseUrlHost(baseUrl: string): string {
  return new URL(baseUrl).host
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export function findOllamaExecutable(): string {
  const cwd = process.cwd()
  const ancestors = [cwd, resolve(cwd, '..'), resolve(cwd, '..', '..'), resolve(cwd, '..', '..', '..')]
  const relativeCandidates = [
    'bin/ollama.exe',
    'sidecar/bin/ollama.exe',
    'resources/ollama/ollama.exe',
    'src-tauri/resources/ollama/ollama.exe',
    '_resources/ollama/ollama.exe',
    '_up_/ollama/ollama.exe',
  ]

  const envCandidates = [process.env.OLLAMA_PATH, process.env.OLLAMA_EXE].filter((candidate): candidate is string => Boolean(candidate))
  for (const candidate of envCandidates) {
    if (existsSync(candidate)) return candidate
  }

  for (const base of ancestors) {
    for (const relative of relativeCandidates) {
      const candidate = resolve(base, relative)
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }

  const installed = 'C:\\Users\\walace\\AppData\\Local\\Programs\\Ollama\\ollama.exe'
  if (existsSync(installed)) {
    return installed
  }

  return 'ollama'
}

async function ollamaHealthy(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`)
    return response.ok
  } catch {
    return false
  }
}

async function waitForOllama(baseUrl: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await ollamaHealthy(baseUrl)) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error('Ollama server did not become ready in time')
}

async function startOllamaServer(baseUrl: string): Promise<void> {
  if (await ollamaHealthy(baseUrl)) return

  if (ollamaProcess) return

  const executable = findOllamaExecutable()
  const child = spawn(executable, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: baseUrlHost(baseUrl),
    },
    stdio: 'ignore',
    windowsHide: true,
  })

  ollamaProcess = child

  child.on('exit', () => {
    ollamaProcess = null
  })

  await waitForOllama(baseUrl)
}

async function readHeader(filePath: string): Promise<string> {
  const handle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(4)
    await handle.read(buffer, 0, 4, 0)
    return buffer.toString('utf8')
  } finally {
    await handle.close()
  }
}

async function findNativeBlobPath(): Promise<string> {
  const candidateRoots = [
    process.env.OLLAMA_BLOB_DIR,
    join(process.env.USERPROFILE || '', 'Documents', 'blobs'),
    resolve(process.cwd(), 'Documents/blobs'),
    resolve(process.cwd(), 'blobs'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const root of candidateRoots) {
    if (!(await pathExists(root))) continue

    const entries = await readdir(root)
    const files = entries.map((entry) => join(root, entry))

    for (const filePath of files) {
      try {
        const info = await stat(filePath)
        if (!info.isFile() || info.size < 10_000_000) continue

        if ((await readHeader(filePath)) === 'GGUF') {
          return filePath
        }
      } catch {
        // ignore unreadable files
      }
    }

    const biggest = await Promise.all(
      files.map(async (filePath) => {
        try {
          const info = await stat(filePath)
          return { filePath, size: info.size, isFile: info.isFile() }
        } catch {
          return { filePath, size: 0, isFile: false }
        }
      })
    )

    const biggestFile = biggest
      .filter((entry) => entry.isFile)
      .sort((a, b) => b.size - a.size)[0]

    if (biggestFile && (await readHeader(biggestFile.filePath)) === 'GGUF') {
      return biggestFile.filePath
    }
  }

  throw new Error('Native GGUF blob not found in the expected folders')
}

async function ensureModelExists(baseUrl: string, modelName: string): Promise<void> {
  await startOllamaServer(baseUrl)

  const tagsResponse = await fetch(`${baseUrl}/api/tags`)
  if (tagsResponse.ok) {
    const tags = await tagsResponse.json() as { models?: Array<{ name?: string; model?: string }> }
    const exists = tags.models?.some((item) => item.name === modelName || item.model === modelName)
    if (exists) return
  }

  const blobPath = await findNativeBlobPath()
  const tempDir = await mkdtemp(join(tmpdir(), 'fluxcodex-ollama-'))
  const modelfilePath = join(tempDir, 'Modelfile')

  await writeFile(modelfilePath, [
    `FROM "${blobPath.replace(/\\/g, '/')}"`,
    'PARAMETER temperature 1',
    'PARAMETER top_p 0.95',
    'PARAMETER top_k 20',
    'PARAMETER presence_penalty 1.5',
  ].join('\n'), 'utf-8')

  const executable = findOllamaExecutable()
  await execFileAsync(executable, ['create', modelName, '-f', modelfilePath], {
    env: {
      ...process.env,
      OLLAMA_HOST: baseUrlHost(baseUrl),
    },
    maxBuffer: 20 * 1024 * 1024,
  })
}

export async function ensureNativeOllamaModel(baseUrl = DEFAULT_BASE_URL, modelName = DEFAULT_MODEL_NAME): Promise<void> {
  await ensureModelExists(baseUrl, modelName)
}
