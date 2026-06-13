import { EventEmitter } from 'node:events'
import { prisma } from '../lib/prisma.js'
import { MCPClient, type MCPTool } from './mcp-client.js'

export interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'http' | 'sse' | 'ws'
  url?: string
  command?: string
  args?: string
  enabled: boolean
}

export interface McpConnectionStatus {
  serverId: string
  serverName: string
  connected: boolean
  tools: number
  error?: string
  lastPing?: string
}

export interface McpToolInfo {
  serverId: string
  serverName: string
  tool: MCPTool
}

export class McpManager extends EventEmitter {
  private connections = new Map<string, { client: MCPClient; config: McpServerConfig; connected: boolean; error?: string }>()
  private initialized = false

  async start(): Promise<void> {
    const servers = await prisma.mcpServer.findMany({ where: { enabled: true } })
    for (const server of servers) {
      await this.connect({
        id: server.id,
        name: server.name,
        transport: server.transport as McpServerConfig['transport'],
        url: server.url ?? undefined,
        command: server.command ?? undefined,
        args: server.args ?? undefined,
        enabled: server.enabled,
      })
    }
    this.initialized = true
    this.emit('ready', this.getAllTools())
  }

  async stop(): Promise<void> {
    for (const [id] of this.connections) {
      this.disconnect(id)
    }
    this.initialized = false
  }

  async connect(config: McpServerConfig): Promise<void> {
    this.disconnect(config.id)

    try {
      let client: MCPClient

      switch (config.transport) {
        case 'stdio': {
          if (!config.command) throw new Error('command required for stdio transport')
          client = MCPClient.create('stdio', {
            command: config.command,
            args: config.args ? config.args.split(' ').filter(Boolean) : [],
          })
          break
        }
        case 'http': {
          if (!config.url) throw new Error('url required for http transport')
          client = MCPClient.create('http', { url: config.url })
          break
        }
        case 'sse': {
          if (!config.url) throw new Error('url required for sse transport')
          client = MCPClient.create('sse', { url: config.url })
          break
        }
        case 'ws': {
          if (!config.url) throw new Error('url required for ws transport')
          client = MCPClient.create('ws', { url: config.url })
          break
        }
        default:
          throw new Error(`Unknown transport: ${config.transport}`)
      }

      client.on('ready', () => {
        this.emit('server:ready', { serverId: config.id, serverName: config.name })
      })

      client.on('error', (err: Error) => {
        const entry = this.connections.get(config.id)
        if (entry) {
          entry.error = err.message
          entry.connected = false
        }
        this.emit('server:error', { serverId: config.id, serverName: config.name, error: err.message })
      })

      client.on('exit', (code: number | null) => {
        const entry = this.connections.get(config.id)
        if (entry) {
          entry.connected = false
          entry.error = `Process exited with code ${code}`
        }
        this.emit('server:disconnected', { serverId: config.id, serverName: config.name, code })
      })

      try {
        await client.initialize()
      } catch (err) {
        const entry = this.connections.get(config.id)
        if (entry) {
          entry.connected = false
          entry.error = (err as Error).message
        }
        this.connections.set(config.id, {
          client,
          config,
          connected: false,
          error: (err as Error).message,
        })
        this.emit('server:error', { serverId: config.id, serverName: config.name, error: (err as Error).message })
        return
      }

      this.connections.set(config.id, { client, config, connected: true })
      this.emit('server:connected', {
        serverId: config.id,
        serverName: config.name,
        tools: client.getTools().length,
      })
    } catch (err) {
      this.connections.set(config.id, {
        client: null as unknown as MCPClient,
        config,
        connected: false,
        error: (err as Error).message,
      })
      this.emit('server:error', { serverId: config.id, serverName: config.name, error: (err as Error).message })
    }
  }

  disconnect(serverId: string): void {
    const entry = this.connections.get(serverId)
    if (entry?.client) {
      entry.client.stop()
    }
    this.connections.delete(serverId)
    this.emit('server:disconnected', { serverId })
  }

  async reconnect(serverId: string): Promise<void> {
    const entry = this.connections.get(serverId)
    if (!entry) {
      const server = await prisma.mcpServer.findUnique({ where: { id: serverId } })
      if (!server) throw new Error('Server not found')
      await this.connect({
        id: server.id,
        name: server.name,
        transport: server.transport as McpServerConfig['transport'],
        url: server.url ?? undefined,
        command: server.command ?? undefined,
        args: server.args ?? undefined,
        enabled: server.enabled,
      })
      return
    }
    await this.connect(entry.config)
  }

  async refreshTools(): Promise<void> {
    for (const [id, entry] of this.connections) {
      if (entry.connected && entry.client) {
        try {
          await entry.client.listTools()
        } catch {
          entry.connected = false
          entry.error = 'Failed to refresh tools'
        }
      }
    }
  }

  getAllTools(): McpToolInfo[] {
    const result: McpToolInfo[] = []
    for (const [serverId, entry] of this.connections) {
      if (entry.connected && entry.client) {
        for (const tool of entry.client.getTools()) {
          result.push({
            serverId,
            serverName: entry.config.name,
            tool,
          })
        }
      }
    }
    return result
  }

  getServerTools(serverId: string): MCPTool[] {
    const entry = this.connections.get(serverId)
    if (!entry?.client || !entry.connected) return []
    return entry.client.getTools()
  }

  async callTool(serverId: string, toolName: string, params: unknown): Promise<unknown> {
    const entry = this.connections.get(serverId)
    if (!entry?.client) throw new Error(`MCP server ${serverId} not connected`)
    if (!entry.connected) throw new Error(`MCP server ${entry.config.name} is not connected`)
    return entry.client.callTool(toolName, params)
  }

  getStatus(): McpConnectionStatus[] {
    const result: McpConnectionStatus[] = []
    for (const [serverId, entry] of this.connections) {
      result.push({
        serverId,
        serverName: entry.config.name,
        connected: entry.connected,
        tools: entry.client?.getTools().length ?? 0,
        error: entry.error,
        lastPing: entry.connected ? new Date().toISOString() : undefined,
      })
    }
    return result
  }

  getServerStatus(serverId: string): McpConnectionStatus | null {
    const entry = this.connections.get(serverId)
    if (!entry) return null
    return {
      serverId,
      serverName: entry.config.name,
      connected: entry.connected,
      tools: entry.client?.getTools().length ?? 0,
      error: entry.error,
    }
  }

  async testConnection(config: McpServerConfig): Promise<{ success: boolean; tools?: MCPTool[]; error?: string }> {
    try {
      let client: MCPClient
      switch (config.transport) {
        case 'stdio': {
          if (!config.command) return { success: false, error: 'command required' }
          client = MCPClient.create('stdio', {
            command: config.command,
            args: config.args ? config.args.split(' ').filter(Boolean) : [],
          })
          break
        }
        case 'http': {
          if (!config.url) return { success: false, error: 'url required' }
          client = MCPClient.create('http', { url: config.url })
          break
        }
        case 'sse': {
          if (!config.url) return { success: false, error: 'url required' }
          client = MCPClient.create('sse', { url: config.url })
          break
        }
        case 'ws': {
          if (!config.url) return { success: false, error: 'url required' }
          client = MCPClient.create('ws', { url: config.url })
          break
        }
        default:
          return { success: false, error: `Unknown transport: ${config.transport}` }
      }

      const tools = await client.listTools()
      client.stop()
      return { success: true, tools }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

export const mcpManager = new McpManager()
