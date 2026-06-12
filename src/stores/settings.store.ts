import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiKey, McpServer, LLMProvider } from '@/types'

const LOCAL_NATIVE_MODEL = 'qwen3.5:4b'

// Lista de modelos de nuvem conhecidos. Qualquer outro modelo é tratado como local.
export const CLOUD_MODEL_PREFIXES = [
  'claude', 'gpt', 'gemini', 'deepseek', 'mistral', 'groq',
  'anthropic', 'openai', 'llama',
]

export function isCloudModel(model: string): boolean {
  return CLOUD_MODEL_PREFIXES.some(prefix => model.toLowerCase().startsWith(prefix))
}

interface SettingsStore {
  apiKeys: ApiKey[]
  mcpServers: McpServer[]
  activeModel: string
  availableModels: LLMProvider[]

  setApiKeys: (keys: ApiKey[]) => void
  addApiKey: (key: ApiKey) => void
  removeApiKey: (id: string) => void
  setMcpServers: (servers: McpServer[]) => void
  addMcpServer: (server: McpServer) => void
  removeMcpServer: (id: string) => void
  toggleMcpServer: (id: string) => void
  setActiveModel: (model: string) => void
  setAvailableModels: (models: LLMProvider[]) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKeys: [],
      mcpServers: [],
      activeModel: LOCAL_NATIVE_MODEL,
      availableModels: [],

      setApiKeys: (keys) => set({ apiKeys: keys }),

      addApiKey: (key) =>
        set((state) => ({ apiKeys: [...state.apiKeys, key] })),

      removeApiKey: (id) =>
        set((state) => ({
          apiKeys: state.apiKeys.filter((k) => k.id !== id),
        })),

      setMcpServers: (servers) => set({ mcpServers: servers }),

      addMcpServer: (server) =>
        set((state) => ({ mcpServers: [...state.mcpServers, server] })),

      removeMcpServer: (id) =>
        set((state) => ({
          mcpServers: state.mcpServers.filter((s) => s.id !== id),
        })),

      toggleMcpServer: (id) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
          ),
        })),

      setActiveModel: (model) => set({ activeModel: model }),

      setAvailableModels: (models) => set({ availableModels: models }),
    }),
    {
      name: 'fluxcodex-settings',
      partialize: (state) => ({
        activeModel: state.activeModel,
      }),
    }
  )
)
