import { spawn, type ChildProcess } from 'node:child_process'

interface MCPRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: unknown
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

interface MCPTool {
  name: string
  description: string
  inputSchema: unknown
}

interface MCPTransport {
  send(request: MCPRequest): Promise<MCPResponse>
  start(): void
  stop(): void
}

class StdioTransport implements MCPTransport {
  private process: ChildProcess | null = null
  private pending = new Map<string, { resolve: (v: MCPResponse) => void; reject: (e: Error) => void }>()
  private buffer = ''

  constructor(
    private command: string,
    private args: string[] = [],
  ) {}

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
        } catch {
          // skip malformed
        }
      }
    })
  }

  stop(): void {
    this.process?.kill()
    this.process = null
  }

  async send(request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject })

      const timeout = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`MCP request timed out: ${request.method}`))
      }, 30000)

      this.process?.stdin?.write(JSON.stringify(request) + '\n')

      const originalResolve = resolve
      this.pending.set(request.id, {
        resolve: (v) => { clearTimeout(timeout); originalResolve(v) },
        reject: (e) => { clearTimeout(timeout); reject(e) },
      })
    })
  }
}

class HttpTransport implements MCPTransport {
  constructor(private url: string) {}

  start(): void {}
  stop(): void {}

  async send(request: MCPRequest): Promise<MCPResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return response.json()
  }
}

export class MCPClient {
  private transport: MCPTransport
  private nextId = 1

  constructor(transport: MCPTransport) {
    this.transport = transport
    this.transport.start()
  }

  private nextIdStr(): string {
    return String(this.nextId++)
  }

  async listTools(): Promise<MCPTool[]> {
    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.nextIdStr(),
      method: 'tools/list',
    })
    return (response.result as { tools: MCPTool[] })?.tools ?? []
  }

  async callTool(name: string, params: unknown): Promise<unknown> {
    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.nextIdStr(),
      method: 'tools/call',
      params: { name, arguments: params },
    })
    return response.result
  }

  async listResources(): Promise<unknown[]> {
    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.nextIdStr(),
      method: 'resources/list',
    })
    return (response.result as { resources: unknown[] })?.resources ?? []
  }

  stop(): void {
    this.transport.stop()
  }

  static createStdio(command: string, args: string[] = []): MCPClient {
    return new MCPClient(new StdioTransport(command, args))
  }

  static createHttp(url: string): MCPClient {
    return new MCPClient(new HttpTransport(url))
  }
}
