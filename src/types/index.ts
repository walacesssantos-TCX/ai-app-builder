export type ChatMode = 'chat' | 'agent' | 'think'

export interface Project {
  id: string
  name: string
  path: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  projectId: string
  title?: string
  model: string
  mode: ChatMode
  createdAt: string
}

export interface FileAttachment {
  name: string
  mimeType: string
  size: number
  content: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata?: string
  attachments?: FileAttachment[]
  createdAt: string
}

export interface ToolDef {
  name: string
  description: string
  exec: string
  permissions: string[]
}

export interface SkillMeta {
  name: string
  description: string
  content: string
  path: string
  priority: number
  category?: string
  tags?: string[]
  tools?: ToolDef[]
}

export interface Skill extends SkillMeta {
  pinned: boolean
}

export interface ActiveSkill {
  name: string
  description: string
  content: string
  priority: number
  tools: ToolDef[]
}

export interface OpenFile {
  id: string
  path: string
  name: string
  language: string
  content: string
  isDirty: boolean
}

export interface ApiKey {
  id: string
  provider: string
  name: string
  keyHash: string
  createdAt: string
}

export interface McpServer {
  id: string
  name: string
  transport: 'stdio' | 'http' | 'sse' | 'ws'
  url?: string
  command?: string
  args?: string
  enabled: boolean
  createdAt: string
}

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

export interface FluxcodexPaths {
  project_root: string
  skills_dir: string
  app_dir: string
}

export interface TerminalSession {
  id: string
  title: string
  cwd: string
}

export interface TerminalEvent {
  output: string
  stream: 'stdout' | 'stderr' | 'status' | 'exit'
}

export interface LLMProvider {
  name: string
  models: string[]
}

export type AgentEventType = 'thinking' | 'message' | 'tool_call' | 'tool_result' | 'subagent_task' | 'subagent_event' | 'subagent_result'

export interface AgentEvent {
  type: AgentEventType
  content?: string
  tool?: string
  params?: unknown
  result?: string
  subagent?: string
}

export interface SubagentDefinition {
  name: string
  description: string
  systemPrompt: string
  allowedTools: string[]
  model?: string
  isBuiltin: boolean
}

export const LANGUAGES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  cs: 'csharp',
  sql: 'sql',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  md: 'markdown',
  xml: 'xml',
  sh: 'shell',
  ps1: 'powershell',
}
