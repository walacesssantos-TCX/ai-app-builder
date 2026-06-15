import { create } from 'zustand'
import type { Message, FileAttachment, Conversation, ChatMode, AgentEvent } from '@/types'
import { api } from '@/lib/api'

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  isStreaming: boolean
  mode: ChatMode
  streamingContent: string
  agentEvents: AgentEvent[]
  isAgentRunning: boolean
  compact: boolean
  totalTokens: number
  pendingFiles: FileAttachment[]

  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  setMode: (mode: ChatMode) => void
  addMessage: (message: Message) => void
  appendStreamChunk: (chunk: string) => void
  setIsStreaming: (value: boolean) => void
  clearStream: () => void
  addAgentEvent: (event: AgentEvent) => void
  clearAgentEvents: () => void
  setAgentRunning: (value: boolean) => void
  newConversation: (id: string, model: string) => void
  toggleCompact: () => void
  addTokens: (count: number) => void
  resetTokens: () => void
  addPendingFile: (file: FileAttachment) => void
  removePendingFile: (name: string) => void
  clearPendingFiles: () => void
  loadConversations: () => Promise<void>
  persistConversation: (id: string) => Promise<void>
  persistMessage: (conversationId: string, message: Message) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  mode: 'chat',
  streamingContent: '',
  agentEvents: [],
  isAgentRunning: false,
  compact: false,
  totalTokens: 0,
  pendingFiles: [],

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMode: (mode) => set({ mode }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendStreamChunk: (chunk) =>
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    })),

  setIsStreaming: (value) => set({ isStreaming: value }),

  clearStream: () => set({ streamingContent: '' }),

  addAgentEvent: (event) =>
    set((state) => ({
      agentEvents: [...state.agentEvents, event],
    })),

  clearAgentEvents: () => set({ agentEvents: [] }),

  setAgentRunning: (value) => set({ isAgentRunning: value }),

  newConversation: (id, model) =>
    set((state) => {
      const conv: Conversation = {
        id,
        projectId: '',
        title: 'Nova conversa',
        model,
        mode: state.mode,
        createdAt: new Date().toISOString(),
      }
      return {
        conversations: [conv, ...state.conversations],
        activeConversationId: id,
        messages: [],
        streamingContent: '',
      }
    }),

  toggleCompact: () =>
    set((state) => ({ compact: !state.compact })),

  addTokens: (count) =>
    set((state) => ({ totalTokens: state.totalTokens + count })),

  resetTokens: () => set({ totalTokens: 0 }),

  addPendingFile: (file) =>
    set((state) => ({ pendingFiles: [...state.pendingFiles, file] })),

  removePendingFile: (name) =>
    set((state) => ({ pendingFiles: state.pendingFiles.filter(f => f.name !== name) })),

  clearPendingFiles: () => set({ pendingFiles: [] }),

  loadConversations: async () => {
    try {
      const list = await api.conversations.listAll()
      const convs: Conversation[] = list.map(c => ({
        id: c.id,
        projectId: '',
        title: c.title || 'Nova conversa',
        model: c.model,
        mode: c.mode as ChatMode,
        createdAt: c.createdAt,
      }))
      set({ conversations: convs })
    } catch {
      // sidecar offline — use local state only
    }
  },

  persistConversation: async (id) => {
    try {
      const state = get()
      const local = state.conversations.find(c => c.id === id)
      if (!local) return
      // Check if already persisted on backend
      try {
        await api.conversations.get(id)
        return // already exists
      } catch {
        // 404 — create it
      }
      await api.conversations.createGlobal({
        title: local.title,
        model: local.model,
        mode: local.mode,
      })
    } catch {
      // silent
    }
  },

  persistMessage: async (conversationId, message) => {
    try {
      await api.conversations.messages.create(conversationId, {
        role: message.role,
        content: message.content,
        metadata: message.attachments ? JSON.stringify(message.attachments) : undefined,
      })
    } catch {
      // silent
    }
  },

  deleteConversation: async (id) => {
    try {
      await api.conversations.delete(id)
    } catch {
      // silent
    }
    set((state) => ({
      conversations: state.conversations.filter(c => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
      messages: state.activeConversationId === id ? [] : state.messages,
    }))
  },
}))
