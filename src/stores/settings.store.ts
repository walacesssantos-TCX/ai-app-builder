import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiKey, McpServer, LLMProvider } from '@/types'

const LOCAL_NATIVE_MODEL = 'llama-3.3-70b-versatile'

// Lista de modelos de nuvem conhecidos. Qualquer outro modelo é tratado como local.
export const CLOUD_MODEL_PREFIXES = [
  'claude', 'gpt', 'gemini', 'deepseek', 'mistral', 'groq',
  'anthropic', 'openai', 'llama',
]

export function isCloudModel(model: string): boolean {
  return CLOUD_MODEL_PREFIXES.some(prefix => model.toLowerCase().startsWith(prefix))
}

export type ThemeId = 'dark' | 'light' | 'gray'

export type ColorVars = Partial<{
  '--zinc-50': string
  '--zinc-100': string
  '--zinc-200': string
  '--zinc-300': string
  '--zinc-400': string
  '--zinc-500': string
  '--zinc-600': string
  '--zinc-700': string
  '--zinc-800': string
  '--zinc-900': string
  '--zinc-950': string
  '--brand': string
  '--brand-50': string
  '--brand-100': string
  '--brand-200': string
  '--brand-300': string
  '--brand-400': string
  '--brand-500': string
  '--brand-600': string
  '--brand-700': string
  '--brand-800': string
  '--brand-900': string
  '--brand-950': string
  '--gold': string
  '--gold-50': string
  '--gold-100': string
  '--gold-200': string
  '--gold-300': string
  '--gold-400': string
  '--gold-500': string
  '--gold-600': string
  '--gold-700': string
  '--gold-800': string
  '--gold-900': string
  '--gold-950': string
}>

export interface Theme {
  id: ThemeId
  label: string
  icon: string // emoji for the theme card
  colors: ColorVars
}

export const themes: Theme[] = [
  {
    id: 'dark',
    label: 'Escuro',
    icon: '🌙',
    colors: {
      '--zinc-50': '#FAF8F5',
      '--zinc-100': '#F0EDE6',
      '--zinc-200': '#D9D2C4',
      '--zinc-300': '#BFB5A0',
      '--zinc-400': '#A6987C',
      '--zinc-500': '#8C7C5E',
      '--zinc-600': '#6F6248',
      '--zinc-700': '#524734',
      '--zinc-800': '#352E20',
      '--zinc-900': '#1C1810',
      '--zinc-950': '#080705',
      '--brand': '#CC0000',
      '--brand-50': '#FFF0F0',
      '--brand-100': '#FFD6D6',
      '--brand-200': '#FFA8A8',
      '--brand-300': '#FF7070',
      '--brand-400': '#FF3838',
      '--brand-500': '#CC0000',
      '--brand-600': '#A30000',
      '--brand-700': '#7A0000',
      '--brand-800': '#520000',
      '--brand-900': '#2B0000',
      '--brand-950': '#140000',
      '--gold': '#C9950E',
      '--gold-50': '#FEF8E7',
      '--gold-100': '#FDEFC3',
      '--gold-200': '#FBDF87',
      '--gold-300': '#F7C940',
      '--gold-400': '#D4A017',
      '--gold-500': '#C9950E',
      '--gold-600': '#A0770B',
      '--gold-700': '#775809',
      '--gold-800': '#4F3A06',
      '--gold-900': '#281D03',
      '--gold-950': '#140F01',
    },
  },
  {
    id: 'light',
    label: 'Claro',
    icon: '☀️',
    colors: {
      '--zinc-50': '#1A1A1A',
      '--zinc-100': '#333333',
      '--zinc-200': '#4D4D4D',
      '--zinc-300': '#666666',
      '--zinc-400': '#808080',
      '--zinc-500': '#999999',
      '--zinc-600': '#B3B3B3',
      '--zinc-700': '#CCCCCC',
      '--zinc-800': '#E0E0E0',
      '--zinc-900': '#F5F5F5',
      '--zinc-950': '#FAFAFA',
      '--brand': '#CC0000',
      '--brand-50': '#FFF0F0',
      '--brand-100': '#FFD6D6',
      '--brand-200': '#FFA8A8',
      '--brand-300': '#FF7070',
      '--brand-400': '#FF3838',
      '--brand-500': '#CC0000',
      '--brand-600': '#A30000',
      '--brand-700': '#7A0000',
      '--brand-800': '#520000',
      '--brand-900': '#2B0000',
      '--brand-950': '#140000',
      '--gold': '#C9950E',
      '--gold-50': '#FEF8E7',
      '--gold-100': '#FDEFC3',
      '--gold-200': '#FBDF87',
      '--gold-300': '#F7C940',
      '--gold-400': '#D4A017',
      '--gold-500': '#C9950E',
      '--gold-600': '#A0770B',
      '--gold-700': '#775809',
      '--gold-800': '#4F3A06',
      '--gold-900': '#281D03',
      '--gold-950': '#140F01',
    },
  },
  {
    id: 'gray',
    label: 'Cinza',
    icon: '◐',
    colors: {
      '--zinc-50': '#E8E8E8',
      '--zinc-100': '#D4D4D4',
      '--zinc-200': '#B8B8B8',
      '--zinc-300': '#A0A0A0',
      '--zinc-400': '#888888',
      '--zinc-500': '#707070',
      '--zinc-600': '#585858',
      '--zinc-700': '#404040',
      '--zinc-800': '#2A2A2A',
      '--zinc-900': '#1A1A1A',
      '--zinc-950': '#0D0D0D',
      '--brand': '#6B6B6B',
      '--brand-50': '#F5F5F5',
      '--brand-100': '#EBEBEB',
      '--brand-200': '#D6D6D6',
      '--brand-300': '#C2C2C2',
      '--brand-400': '#ADADAD',
      '--brand-500': '#6B6B6B',
      '--brand-600': '#565656',
      '--brand-700': '#424242',
      '--brand-800': '#2D2D2D',
      '--brand-900': '#191919',
      '--brand-950': '#0C0C0C',
      '--gold': '#888888',
      '--gold-50': '#F5F5F5',
      '--gold-100': '#EBEBEB',
      '--gold-200': '#D6D6D6',
      '--gold-300': '#C2C2C2',
      '--gold-400': '#ADADAD',
      '--gold-500': '#888888',
      '--gold-600': '#6E6E6E',
      '--gold-700': '#555555',
      '--gold-800': '#3B3B3B',
      '--gold-900': '#222222',
      '--gold-950': '#111111',
    },
  },
]

interface SettingsStore {
  apiKeys: ApiKey[]
  mcpServers: McpServer[]
  activeModel: string
  availableModels: LLMProvider[]
  theme: ThemeId

  setApiKeys: (keys: ApiKey[]) => void
  addApiKey: (key: ApiKey) => void
  removeApiKey: (id: string) => void
  setMcpServers: (servers: McpServer[]) => void
  addMcpServer: (server: McpServer) => void
  removeMcpServer: (id: string) => void
  toggleMcpServer: (id: string) => void
  setActiveModel: (model: string) => void
  setAvailableModels: (models: LLMProvider[]) => void
  setTheme: (theme: ThemeId) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKeys: [],
      mcpServers: [],
      activeModel: LOCAL_NATIVE_MODEL,
      availableModels: [],
      theme: 'dark',

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

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'fluxcodex-settings',
      partialize: (state) => ({
        activeModel: state.activeModel,
        theme: state.theme,
      }),
    }
  )
)
