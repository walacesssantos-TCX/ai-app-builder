import { create } from 'zustand'
import type { Message, Conversation, ChatMode, AgentEvent } from '@/types'

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
}

export const useChatStore = create<ChatStore>((set) => ({
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
        conversations: [...state.conversations, conv],
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
}))
