const BASE = 'http://127.0.0.1:3001'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API ${method} ${path}: ${res.status} ${err}`)
  }
  return res.json()
}

export interface ApiKeyDto {
  id: string
  provider: string
  name: string
  keyHash: string
  createdAt: string
}

export interface ProjectDto {
  id: string
  name: string
  path: string
  description?: string
  conversationCount: number
  createdAt: string
  updatedAt: string
}

export interface ConversationDto {
  id: string
  projectId: string
  title?: string
  model: string
  mode: string
  messageCount: number
  createdAt: string
}

export interface MessageDto {
  id: string
  conversationId: string
  role: string
  content: string
  metadata?: string
  createdAt: string
}

export interface McpServerDto {
  id: string
  name: string
  transport: string
  url?: string
  command?: string
  args?: string
  enabled: boolean
  createdAt: string
}

export const api = {
  health: () => request<{ status: string }>('GET', '/health'),

  models: () => request<{ models: string[] }>('GET', '/models'),

  apiKeys: {
    list: () => request<ApiKeyDto[]>('GET', '/api-keys'),
    create: (data: { provider: string; name: string; key: string }) =>
      request<ApiKeyDto>('POST', '/api-keys', data),
    update: (id: string, data: Record<string, string>) =>
      request<ApiKeyDto>('PUT', `/api-keys/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/api-keys/${id}`),
  },

  projects: {
    list: () => request<ProjectDto[]>('GET', '/projects'),
    create: (data: { name: string; path: string; description?: string }) =>
      request<ProjectDto>('POST', '/projects', data),
    get: (id: string) => request<ProjectDto>('GET', `/projects/${id}`),
    update: (id: string, data: Record<string, string | undefined>) =>
      request<ProjectDto>('PUT', `/projects/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/projects/${id}`),
  },

  conversations: {
    list: (projectId: string) =>
      request<ConversationDto[]>('GET', `/projects/${projectId}/conversations`),
    create: (projectId: string, data: { title?: string; model?: string; mode?: string }) =>
      request<ConversationDto>('POST', `/projects/${projectId}/conversations`, data),
    get: (id: string) => request<ConversationDto & { messages: MessageDto[] }>('GET', `/conversations/${id}`),
    delete: (id: string) => request<void>('DELETE', `/conversations/${id}`),
    messages: {
      list: (conversationId: string) =>
        request<MessageDto[]>('GET', `/conversations/${conversationId}/messages`),
      create: (conversationId: string, data: { role: string; content: string; metadata?: string }) =>
        request<MessageDto>('POST', `/conversations/${conversationId}/messages`, data),
    },
  },

  database: {
    listDbs: (projectPath: string) =>
      request<{ databases: string[] }>('POST', '/database/list-dbs', { projectPath }),
    tables: (dbPath: string) =>
      request<{ tables: { name: string; columns: { name: string; type: string; notNull: boolean; pk: boolean }[]; rowCount: number }[] }>('POST', '/database/tables', { dbPath }),
    query: (dbPath: string, table: string, limit?: number, offset?: number) =>
      request<{ columns: string[]; rows: unknown[][]; rowCount: number; executionTime: number }>('POST', '/database/query', { dbPath, table, limit, offset }),
    execute: (dbPath: string, sql: string) =>
      request<{ columns: string[]; rows: unknown[][]; rowCount: number; executionTime: number }>('POST', '/database/execute', { dbPath, sql }),
  },

  mcpServers: {
    list: () => request<McpServerDto[]>('GET', '/mcp-servers'),
    create: (data: { name: string; transport: string; url?: string; command?: string; args?: string }) =>
      request<McpServerDto>('POST', '/mcp-servers', data),
    update: (id: string, data: Record<string, string | undefined>) =>
      request<McpServerDto>('PUT', `/mcp-servers/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/mcp-servers/${id}`),
    toggle: (id: string) => request<{ enabled: boolean }>('PUT', `/mcp-servers/${id}/toggle`),
  },
}
