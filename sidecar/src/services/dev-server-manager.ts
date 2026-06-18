import { spawn, type ChildProcess } from 'node:child_process'
import { watch, type FSWatcher } from 'node:fs'
import { resolve } from 'node:path'
import { EventEmitter } from 'node:events'

interface DevServerInfo {
  projectPath: string
  port: number | null
  pid: number | null
  running: boolean
  command: string
  stdout: string[]
}

interface FileChangeEvent {
  type: 'file_changed'
  projectPath: string
  filePath: string
  timestamp: number
}

const PORT_PATTERNS = [
  /(?:https?:\/\/)?localhost:(\d{2,5})/i,
  /port (\d{2,5})/i,
  /port[:\s]*(\d{2,5})/i,
  /listening on (\d{2,5})/i,
  /started on (\d{2,5})/i,
]

function detectPort(text: string): number | null {
  for (const pattern of PORT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const port = parseInt(match[1], 10)
      if (port >= 1024 && port <= 65535) return port
    }
  }
  return null
}

export class DevServerManager extends EventEmitter {
  private servers = new Map<string, DevServerInfo>()
  private processes = new Map<string, ChildProcess>()
  private watchers = new Map<string, FSWatcher>()
  private sseClients = new Map<string, Set<(event: FileChangeEvent) => void>>()

  start(projectPath: string, command = 'npm run dev'): Promise<DevServerInfo> {
    return new Promise((resolvePromise, reject) => {
      const existing = this.servers.get(projectPath)
      if (existing?.running) {
        resolvePromise(existing)
        return
      }

      const info: DevServerInfo = {
        projectPath,
        port: null,
        pid: null,
        running: false,
        command,
        stdout: [],
      }
      this.servers.set(projectPath, info)

      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : 'bash'
      const shellArgs = isWin ? ['/c'] : ['-c']
      const child = spawn(shell, [...shellArgs, command], {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      })

      info.pid = child.pid ?? null
      this.processes.set(projectPath, child)

      const timeout = setTimeout(() => {
        if (!info.running) {
          reject(new Error(`Dev server did not start within 60s: ${info.stdout.join('\n')}`))
        }
      }, 60000)

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        info.stdout.push(text)
        if (info.stdout.length > 200) info.stdout.shift()

        if (!info.port) {
          const port = detectPort(text)
          if (port) {
            info.port = port
            info.running = true
            clearTimeout(timeout)
            this.startWatching(projectPath)
            resolvePromise({ ...info })
          }
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8')
        info.stdout.push(text)

        if (!info.port) {
          const port = detectPort(text)
          if (port) {
            info.port = port
            info.running = true
            clearTimeout(timeout)
            this.startWatching(projectPath)
            resolvePromise({ ...info })
          }
        }
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        info.running = false
        reject(err)
      })

      child.on('exit', (code) => {
        info.running = false
        info.pid = null
        this.stopWatching(projectPath)
        this.processes.delete(projectPath)
      })
    })
  }

  stop(projectPath: string): boolean {
    const child = this.processes.get(projectPath)
    if (!child) return false

    try {
      child.kill('SIGTERM')
    } catch {
      try {
        process.kill(child.pid!, 'SIGTERM')
      } catch {
        // force kill
      }
    }

    this.stopWatching(projectPath)
    this.processes.delete(projectPath)
    const info = this.servers.get(projectPath)
    if (info) {
      info.running = false
      info.pid = null
    }
    return true
  }

  getStatus(projectPath: string): DevServerInfo | null {
    return this.servers.get(projectPath) ?? null
  }

  getAllStatuses(): DevServerInfo[] {
    return Array.from(this.servers.values())
  }

  stopAll(): void {
    for (const projectPath of this.processes.keys()) {
      this.stop(projectPath)
    }
  }

  private startWatching(projectPath: string): void {
    if (this.watchers.has(projectPath)) return

    try {
      const watcher = watch(projectPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        const name = typeof filename === 'string' ? filename : String(filename)

        if (
          name.includes('node_modules') ||
          name.includes('.git') ||
          name.includes('.next') ||
          name.endsWith('.log')
        ) return

        const changeEvent: FileChangeEvent = {
          type: 'file_changed',
          projectPath,
          filePath: name,
          timestamp: Date.now(),
        }

        const clients = this.sseClients.get(projectPath)
        if (clients) {
          for (const handler of clients) {
            handler(changeEvent)
          }
        }
      })
      this.watchers.set(projectPath, watcher)
    } catch {
      // recursive watch may not be available on all platforms
    }
  }

  private stopWatching(projectPath: string): void {
    const watcher = this.watchers.get(projectPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(projectPath)
    }
  }

  subscribe(projectPath: string, handler: (event: FileChangeEvent) => void): () => void {
    let clients = this.sseClients.get(projectPath)
    if (!clients) {
      clients = new Set()
      this.sseClients.set(projectPath, clients)
    }
    clients.add(handler)
    return () => {
      clients?.delete(handler)
      if (clients?.size === 0) {
        this.sseClients.delete(projectPath)
      }
    }
  }

  onShutdown(): void {
    this.stopAll()
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    this.sseClients.clear()
  }
}

export const devServerManager = new DevServerManager()
