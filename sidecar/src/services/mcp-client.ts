import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

export interface MCPRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: unknown
}

export interface MCPResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: unknown
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPTransport {
  send(request: MCPRequest): Promise<MCPResponse>
  start(): void
  stop(): void
  onMessage?: (handler: (msg: unknown) => void) => void
}

class StdioTransport extends EventEmitter implements MCPTransport {
  private process: ChildProcess | null = null
  private pending = new Map<string, { resolve: (v: MCPResponse) => void; reject: (e: Error) => void }>()
  private buffer = ''
  private _onMessage: ((msg: unknown) => void) | null = null

  constructor(
    private command: string,
    private args: string[] = [],
  ) { super() }

  onMessage(handler: (msg: unknown) => void): void {
    this._onMessage = handler
  }

  start(): void {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const response: MCPResponse = JSON.parse(line)
          const pending = this.pending.get(response.id)
          if (pending) {
            pending.resolve(response)
            this.pending.delete(response.id)
          }
          this._onMessage?.(response)
          this.emit('message', response)
        } catch {
          // skip malformed
        }
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString())
    })

    this.process.on('exit', (code) => {
      this.emit('exit', code)
    })
  }

  stop(): void {
    this.process?.kill()
    this.process = null
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`MCP request timed out: ${request.method}`))
      }, 30000)

      this.pending.set(request.id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v) },
        reject: (e) => { clearTimeout(timeout); reject(e) },
      })

      this.process?.stdin?.write(JSON.stringify(request) + '\n')
    })
  }
}

class HttpTransport implements MCPTransport {
  private _onMessage: ((msg: unknown) => void) | null = null

  constructor(private url: string) {}

  onMessage(handler: (msg: unknown) => void): void {
    this._onMessage = handler
  }

  start(): void {}
  stop(): void {}

  async send(request: MCPRequest): Promise<MCPResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const json = await response.json()
    this._onMessage?.(json)
    return json
  }
}

class SseTransport extends EventEmitter implements MCPTransport {
  private abortController: AbortController | null = null
  private pending = new Map<string, { resolve: (v: MCPResponse) => void; reject: (e: Error) => void }>()
  private _onMessage: ((msg: unknown) => void) | null = null
  private connected = false

  constructor(private url: string) { super() }

  onMessage(handler: (msg: unknown) => void): void {
    this._onMessage = handler
  }

  start(): void {
    this.abortController = new AbortController()
    this.connectSSE()
  }

  private async connectSSE(): Promise<void> {
    try {
      const response = await fetch(this.url, {
        signal: this.abortController?.signal,
        headers: { Accept: 'text/event-stream' },
      })

      if (!response.ok) {
        this.emit('error', new Error(`SSE connection failed: ${response.status}`))
        return
      }

      this.connected = true
      this.emit('connected')

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              const pending = this.pending.get(data.id)
              if (pending) {
                pending.resolve(data)
                this.pending.delete(data.id)
              }
              this._onMessage?.(data)
              this.emit('message', data)
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.emit('error', err)
      }
    } finally {
      this.connected = false
      this.emit('disconnected')
    }
  }

  stop(): void {
    this.abortController?.abort()
    this.abortController = null
    this.connected = false
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    if (!this.connected) {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      return response.json()
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`MCP SSE request timed out: ${request.method}`))
      }, 30000)

      this.pending.set(request.id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v) },
        reject: (e) => { clearTimeout(timeout); reject(e) },
      })

      fetch(this.url.replace(/\/sse$/, '/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }).catch(err => {
        clearTimeout(timeout)
        this.pending.delete(request.id)
        reject(err)
      })
    })
  }
}

class WsTransport extends EventEmitter implements MCPTransport {
  private ws: any = null
  private pending = new Map<string, { resolve: (v: MCPResponse) => void; reject: (e: Error) => void }>()
  private _onMessage: ((msg: unknown) => void) | null = null
  private connected = false
  private connectPromise: Promise<void> | null = null

  constructor(private url: string) { super() }

  onMessage(handler: (msg: unknown) => void): void {
    this._onMessage = handler
  }

  start(): void {
    this.connectPromise = this.doConnect()
  }

  private async doConnect(): Promise<void> {
    try {
      const WebSocket = (await import('ws')).default
      this.ws = new WebSocket(this.url)

      this.ws.on('open', () => {
        this.connected = true
        this.emit('connected')
      })

      this.ws.on('message', (data: Buffer | string) => {
        try {
          const response: MCPResponse = JSON.parse(data.toString())
          const pending = this.pending.get(response.id)
          if (pending) {
            pending.resolve(response)
            this.pending.delete(response.id)
          }
          this._onMessage?.(response)
          this.emit('message', response)
        } catch {
          // skip malformed
        }
      })

      this.ws.on('close', () => {
        this.connected = false
        this.emit('disconnected')
      })

      this.ws.on('error', (err: Error) => {
        this.emit('error', err)
      })
    } catch (err) {
      this.emit('error', new Error('ws package not installed. Run: npm install ws'))
    }
  }

  stop(): void {
    this.ws?.close()
    this.ws = null
    this.connected = false
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    if (this.connectPromise) {
      await this.connectPromise
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not connected'))
        return
      }

      const timeout = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`MCP WS request timed out: ${request.method}`))
      }, 30000)

      this.pending.set(request.id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v) },
        reject: (e) => { clearTimeout(timeout); reject(e) },
      })

      this.ws.send(JSON.stringify(request))
    })
  }
}

export class MCPClient extends EventEmitter {
  private transport: MCPTransport
  private nextId = 1
  private _tools: MCPTool[] = []
  private _resources: MCPResource[] = []

  constructor(transport: MCPTransport) {
    super()
    this.transport = transport
    this.transport.onMessage?.((msg) => this.emit('message', msg))
    this.transport.start()
  }

  private nextIdStr(): string {
    return String(this.nextId++)
  }

  async initialize(): Promise<void> {
    this._tools = await this.listTools()
    try {
      this._resources = await this.listResources()
    } catch {
      this._resources = []
    }
    this.emit('ready', { tools: this._tools, resources: this._resources })
  }

  async listTools(): Promise<MCPTool[]> {
    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.nextIdStr(),
      method: 'tools/list',
    })
    const tools = (response.result as { tools: MCPTool[] })?.tools ?? []
    this._tools = tools
    return tools
  }

  async callTool(name: string, params: unknown): Promise<unknown> {
    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.nextIdStr(),
      method: 'tools/call',
      params: { name, arguments: params },
    })
    if (response.error) {
      throw new Error(`MCP tool error: ${response.error.message}`)
    }
    return response.result
  }

  async listResources(): Promise<MCPResource[]> {
    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.nextIdStr(),
      method: 'resources/list',
    })
    const resources = (response.result as { resources: MCPResource[] })?.resources ?? []
    this._resources = resources
    return resources
  }

  getTools(): MCPTool[] {
    return this._tools
  }

  getResources(): MCPResource[] {
    return this._resources
  }

  async ping(): Promise<boolean> {
    try {
      await this.transport.send({
        jsonrpc: '2.0',
        id: this.nextIdStr(),
        method: 'ping',
      })
      return true
    } catch {
      return false
    }
  }

  stop(): void {
    this.transport.stop()
    this.removeAllListeners()
  }

  static create(transport: 'stdio' | 'http' | 'sse' | 'ws', config: { command?: string; args?: string[]; url?: string }): MCPClient {
    switch (transport) {
      case 'stdio': {
        if (!config.command) throw new Error('command required for stdio transport')
        return new MCPClient(new StdioTransport(config.command, config.args ?? []))
      }
      case 'http': {
        if (!config.url) throw new Error('url required for http transport')
        return new MCPClient(new HttpTransport(config.url))
      }
      case 'sse': {
        if (!config.url) throw new Error('url required for sse transport')
        return new MCPClient(new SseTransport(config.url))
      }
      case 'ws': {
        if (!config.url) throw new Error('url required for ws transport')
        return new MCPClient(new WsTransport(config.url))
      }
    }
  }
}
