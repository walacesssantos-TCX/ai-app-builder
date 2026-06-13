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

export interface McpConnectionStatusDto {
  serverId: string
  serverName: string
  connected: boolean
  tools: number
  error?: string
  lastPing?: string
}

export interface McpToolInfoDto {
  serverId: string
  serverName: string
  tool: {
    name: string
    description: string
    inputSchema: unknown
  }
}

export interface McpToolDetailDto {
  name: string
  description: string
  inputSchema: unknown
}

export interface SubagentDto {
  name: string
  description: string
  systemPrompt: string
  allowedTools: string[]
  model?: string
  isBuiltin: boolean
}

export interface SupabaseConnectionDto {
  id: string
  name: string
  url: string
  anonKey: string
  serviceKey?: string
  hasServiceKey?: boolean
  enabled: boolean
  createdAt: string
}

export interface SupabaseStatusDto {
  id: string
  name: string
  url: string
  enabled: boolean
  connected: boolean
  error?: string
  project?: string
}

export interface DevServerInfoDto {
  projectPath: string
  port: number | null
  pid: number | null
  running: boolean
  command: string
  stdout: string[]
}

export interface DeploymentDto {
  id: string
  name: string
  projectPath: string
  platform: string
  url: string | null
  status: string
  branch: string | null
  buildLog: string | null
  createdAt: string
  updatedAt: string
}

export interface BuildResultDto {
  success: boolean
  log: string
  status: string
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
    status: () => request<McpConnectionStatusDto[]>('GET', '/mcp/status'),
    serverStatus: (id: string) => request<McpConnectionStatusDto>('GET', `/mcp/servers/${id}/status`),
    serverTools: (id: string) => request<{ tools: McpToolDetailDto[] }>('GET', `/mcp/servers/${id}/tools`),
    allTools: () => request<{ tools: McpToolInfoDto[] }>('GET', '/mcp/tools'),
    callTool: (serverId: string, toolName: string, params?: unknown) =>
      request<{ result: unknown }>('POST', '/mcp/tools/call', { serverId, toolName, params }),
    reconnect: (id: string) => request<McpConnectionStatusDto>('POST', `/mcp/servers/${id}/reconnect`),
    testConnection: (data: { name: string; transport: string; url?: string; command?: string; args?: string }) =>
      request<{ success: boolean; tools?: McpToolDetailDto[]; error?: string }>('POST', '/mcp/test-connection', data),
    refreshTools: () => request<{ tools: McpToolInfoDto[] }>('POST', '/mcp/refresh-tools'),
  },

  preview: {
    start: (projectPath: string, command?: string) =>
      request<DevServerInfoDto>('POST', '/preview/start', { projectPath, command }),
    stop: (projectPath: string) =>
      request<{ stopped: boolean }>('POST', '/preview/stop', { projectPath }),
    status: (projectPath?: string) =>
      request<{ server?: DevServerInfoDto; servers?: DevServerInfoDto[] }>('GET', `/preview/status${projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : ''}`),
    detect: (projectPath: string) =>
      request<{ port: number | null }>('POST', '/preview/detect', { projectPath }),
  },

  supabase: {
    list: () => request<SupabaseConnectionDto[]>('GET', '/supabase'),
    create: (data: { name: string; url: string; anonKey: string; serviceKey?: string }) =>
      request<SupabaseConnectionDto>('POST', '/supabase', data),
    update: (id: string, data: { name?: string; url?: string; anonKey?: string; serviceKey?: string; enabled?: boolean }) =>
      request<SupabaseConnectionDto>('PUT', `/supabase/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/supabase/${id}`),
    toggle: (id: string) => request<{ enabled: boolean }>('PUT', `/supabase/${id}/toggle`),
    testConnection: (data: { name: string; url: string; anonKey: string; serviceKey?: string }) =>
      request<{ success: boolean; error?: string; project?: string }>('POST', '/supabase/test-connection', data),
    status: () => request<SupabaseStatusDto[]>('GET', '/supabase/status'),
    connectionStatus: (id: string) => request<SupabaseStatusDto>('GET', `/supabase/${id}/status`),
    tables: (id: string) => request<{ tables: { schema: string; name: string }[] }>('GET', `/supabase/${id}/tables`),
    tableInfo: (id: string, table: string) =>
      request<{ columns: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[] }>('GET', `/supabase/${id}/table-info?table=${encodeURIComponent(table)}`),
    query: (id: string, table: string, options?: { select?: string; limit?: number; offset?: number; order?: string; ascending?: boolean }) =>
      request<{ data: any[]; count: number }>('POST', `/supabase/${id}/query`, { table, ...options }),
    sql: (id: string, query: string) =>
      request<{ data: any }>('POST', `/supabase/${id}/sql`, { query }),
    buckets: (id: string) => request<{ buckets: any[] }>('GET', `/supabase/${id}/buckets`),
    files: (id: string, bucket: string, path?: string) =>
      request<{ files: any[] }>('POST', `/supabase/${id}/files`, { bucket, path }),
    authUsers: (id: string) => request<{ users: any[] }>('GET', `/supabase/${id}/auth-users`),
  },

  kanban: {
    get: (projectPath: string) =>
      request<{ board: any }>('GET', `/kanban/${encodeURIComponent(projectPath)}`),
    save: (projectPath: string, data: any) =>
      request<{ board: any }>('PUT', `/kanban/${encodeURIComponent(projectPath)}`, data),
    addColumn: (projectPath: string, data: { title: string; color?: string }) =>
      request<{ column: any }>('POST', `/kanban/${encodeURIComponent(projectPath)}/columns`, data),
    updateColumn: (projectPath: string, columnId: string, data: { title?: string; color?: string }) =>
      request<{ column: any }>('PUT', `/kanban/${encodeURIComponent(projectPath)}/columns/${columnId}`, data),
    deleteColumn: (projectPath: string, columnId: string) =>
      request<{ deleted: boolean }>('DELETE', `/kanban/${encodeURIComponent(projectPath)}/columns/${columnId}`),
    addCard: (projectPath: string, data: { title: string; columnId: string; description?: string; priority?: string; labels?: string[] }) =>
      request<{ card: any }>('POST', `/kanban/${encodeURIComponent(projectPath)}/cards`, data),
    updateCard: (projectPath: string, cardId: string, data: any) =>
      request<{ card: any }>('PUT', `/kanban/${encodeURIComponent(projectPath)}/cards/${cardId}`, data),
    deleteCard: (projectPath: string, cardId: string) =>
      request<{ deleted: boolean }>('DELETE', `/kanban/${encodeURIComponent(projectPath)}/cards/${cardId}`),
    reorder: (projectPath: string, cards: { id: string; columnId: string; position: number }[]) =>
      request<{ success: boolean }>('PUT', `/kanban/${encodeURIComponent(projectPath)}/reorder`, { cards }),
  },

  subagents: {
    list: () => request<{ subagents: SubagentDto[] }>('GET', '/subagents'),
    create: (data: { name: string; description: string; systemPrompt: string; allowedTools?: string[]; model?: string }) =>
      request<SubagentDto>('POST', '/subagents', data),
    update: (name: string, data: { description?: string; systemPrompt?: string; allowedTools?: string[]; model?: string }) =>
      request<SubagentDto>('PUT', `/subagents/${name}`, data),
    delete: (name: string) => request<void>('DELETE', `/subagents/${name}`),
  },

  github: {
    setToken: (token: string) => request<{ success: boolean }>('POST', '/github/token', { token }),
    getUser: () => request<{ login: string; avatar_url: string; name: string | null; email: string | null }>('GET', '/github/user'),
    listRepos: (type?: string) =>
      request<Array<{ id: number; name: string; full_name: string; html_url: string; description: string | null; private: boolean; default_branch: string }>>('GET', `/github/repos?type=${type || 'owner'}`),
    getRepo: (owner: string, repo: string) => request('GET', `/github/repos/${owner}/${repo}`),
    listBranches: (owner: string, repo: string) =>
      request<Array<{ name: string; commit: { sha: string } }>>('GET', `/github/repos/${owner}/${repo}/branches`),
    listPullRequests: (owner: string, repo: string, state?: string) =>
      request('GET', `/github/repos/${owner}/${repo}/pulls?state=${state || 'open'}`),
    createPullRequest: (owner: string, repo: string, data: { title: string; head: string; base: string; body?: string }) =>
      request('POST', `/github/repos/${owner}/${repo}/pulls`, data),
    listIssues: (owner: string, repo: string, state?: string) =>
      request('GET', `/github/repos/${owner}/${repo}/issues?state=${state || 'open'}`),
    createIssue: (owner: string, repo: string, data: { title: string; body?: string; labels?: string[] }) =>
      request('POST', `/github/repos/${owner}/${repo}/issues`, data),
    status: () => request<{ authenticated: boolean; user: { login: string; name: string | null } | null }>('GET', '/github/status'),
  },

  templates: {
    list: () => request<Array<{ id: string; name: string; description: string; category: string; tags: string[]; fileCount: number }>>('GET', '/templates'),
    get: (id: string) => request<{ id: string; name: string; files: Array<{ path: string; content: string; isDir?: boolean }> }>('GET', `/templates/${id}`),
    create: (id: string, destPath: string, replacements?: Record<string, string>) =>
      request<{ filesCreated: number }>('POST', `/templates/${id}/create`, { destPath, replacements }),
  },

  deploy: {
    list: () => request<DeploymentDto[]>('GET', '/deployments'),
    create: (data: { name: string; projectPath: string; platform?: string; branch?: string }) =>
      request<DeploymentDto>('POST', '/deployments', data),
    build: (id: string) => request<BuildResultDto>('POST', `/deployments/${id}/build`),
    delete: (id: string) => request<void>('DELETE', `/deployments/${id}`),
  },
}
