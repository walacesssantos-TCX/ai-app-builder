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

export type ThemeId = 'default' | 'ocean' | 'forest' | 'royal' | 'amber' | 'minimal'

export interface Theme {
  id: ThemeId
  label: string
  colors: Partial<{
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
}

export const themes: Theme[] = [
  {
    id: 'default',
    label: 'Default (Vermelho)',
    colors: {
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
    id: 'ocean',
    label: 'Oceano (Azul)',
    colors: {
      '--brand': '#0066CC',
      '--brand-50': '#F0F6FF',
      '--brand-100': '#D6E8FF',
      '--brand-200': '#A8CCFF',
      '--brand-300': '#70A8FF',
      '--brand-400': '#3888FF',
      '--brand-500': '#0066CC',
      '--brand-600': '#0052A3',
      '--brand-700': '#003D7A',
      '--brand-800': '#002952',
      '--brand-900': '#00152B',
      '--brand-950': '#000A14',
      '--gold': '#0EC9B8',
      '--gold-50': '#E7FEFB',
      '--gold-100': '#C3FDF5',
      '--gold-200': '#87FBE8',
      '--gold-300': '#40F7D6',
      '--gold-400': '#17D4B8',
      '--gold-500': '#0EC9B8',
      '--gold-600': '#0BA08A',
      '--gold-700': '#087767',
      '--gold-800': '#064F45',
      '--gold-900': '#032822',
      '--gold-950': '#011411',
    },
  },
  {
    id: 'forest',
    label: 'Floresta (Verde)',
    colors: {
      '--brand': '#00A86B',
      '--brand-50': '#F0FFF5',
      '--brand-100': '#D6FFE8',
      '--brand-200': '#A8FFCC',
      '--brand-300': '#70FFA8',
      '--brand-400': '#38FF88',
      '--brand-500': '#00A86B',
      '--brand-600': '#008755',
      '--brand-700': '#006640',
      '--brand-800': '#00452B',
      '--brand-900': '#002416',
      '--brand-950': '#00120B',
      '--gold': '#C9A80E',
      '--gold-50': '#FEF8E7',
      '--gold-100': '#FDEFC3',
      '--gold-200': '#FBDF87',
      '--gold-300': '#F7C940',
      '--gold-400': '#D4A017',
      '--gold-500': '#C9A80E',
      '--gold-600': '#A0870B',
      '--gold-700': '#776608',
      '--gold-800': '#4F4506',
      '--gold-900': '#282303',
      '--gold-950': '#141101',
    },
  },
  {
    id: 'royal',
    label: 'Real (Roxo)',
    colors: {
      '--brand': '#7C3AED',
      '--brand-50': '#F5F0FF',
      '--brand-100': '#E4D6FF',
      '--brand-200': '#C8A8FF',
      '--brand-300': '#A870FF',
      '--brand-400': '#8838FF',
      '--brand-500': '#7C3AED',
      '--brand-600': '#6326C9',
      '--brand-700': '#4B1AA5',
      '--brand-800': '#341180',
      '--brand-900': '#1E0A5C',
      '--brand-950': '#0F0536',
      '--gold': '#E8B80E',
      '--gold-50': '#FEF8E7',
      '--gold-100': '#FDEFC3',
      '--gold-200': '#FBDF87',
      '--gold-300': '#F7C940',
      '--gold-400': '#E8B80E',
      '--gold-500': '#C9950E',
      '--gold-600': '#A0770B',
      '--gold-700': '#775809',
      '--gold-800': '#4F3A06',
      '--gold-900': '#281D03',
      '--gold-950': '#140F01',
    },
  },
  {
    id: 'amber',
    label: 'Âmbar (Laranja)',
    colors: {
      '--brand': '#D97706',
      '--brand-50': '#FFFAF0',
      '--brand-100': '#FFEFD6',
      '--brand-200': '#FFDAA8',
      '--brand-300': '#FFBE70',
      '--brand-400': '#FF9E38',
      '--brand-500': '#D97706',
      '--brand-600': '#B55F05',
      '--brand-700': '#914804',
      '--brand-800': '#6E3103',
      '--brand-900': '#4A1B02',
      '--brand-950': '#260D01',
      '--gold': '#0EA5C9',
      '--gold-50': '#F0FCFE',
      '--gold-100': '#D6F5FD',
      '--gold-200': '#A8EAFB',
      '--gold-300': '#70D8F7',
      '--gold-400': '#38C3F0',
      '--gold-500': '#0EA5C9',
      '--gold-600': '#0B84A0',
      '--gold-700': '#086377',
      '--gold-800': '#06434F',
      '--gold-900': '#032228',
      '--gold-950': '#011114',
    },
  },
  {
    id: 'minimal',
    label: 'Minimal (Cinza)',
    colors: {
      '--brand': '#888888',
      '--brand-50': '#F8F8F8',
      '--brand-100': '#EEEEEE',
      '--brand-200': '#DDDDDD',
      '--brand-300': '#CCCCCC',
      '--brand-400': '#AAAAAA',
      '--brand-500': '#888888',
      '--brand-600': '#666666',
      '--brand-700': '#555555',
      '--brand-800': '#444444',
      '--brand-900': '#333333',
      '--brand-950': '#222222',
      '--gold': '#AAAAAA',
      '--gold-50': '#F8F8F8',
      '--gold-100': '#EEEEEE',
      '--gold-200': '#DDDDDD',
      '--gold-300': '#CCCCCC',
      '--gold-400': '#AAAAAA',
      '--gold-500': '#888888',
      '--gold-600': '#666666',
      '--gold-700': '#555555',
      '--gold-800': '#444444',
      '--gold-900': '#333333',
      '--gold-950': '#222222',
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
      theme: 'default',

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
