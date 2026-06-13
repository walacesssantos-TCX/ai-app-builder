import { useState, useEffect } from 'react'
import { Key, Brain, Boxes, Puzzle, RefreshCw, Bot, Database, Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApiKeysSection } from './ApiKeysSection'
import { ModelsSection } from './ModelsSection'
import { McpServersSection } from './McpServersSection'
import { PluginManager } from './PluginManager'
import { SubagentManagerSection } from './SubagentManagerSection'
import { UpdateSection } from './UpdateSection'
import { SupabaseSection } from './SupabaseSection'
import { GitHubSection } from './GitHubSection'
import { useSettingsStore } from '@/stores/settings.store'
import { invoke } from '@tauri-apps/api/core'

const tabs = [
  { id: 'api-keys', icon: Key, label: 'API Keys' },
  { id: 'models', icon: Brain, label: 'Modelos' },
  { id: 'plugins', icon: Puzzle, label: 'Plugins' },
  { id: 'subagents', icon: Bot, label: 'Subagentes' },
  { id: 'mcp', icon: Boxes, label: 'MCP Servers' },
  { id: 'github', icon: Github, label: 'GitHub' },
  { id: 'supabase', icon: Database, label: 'Supabase' },
  { id: 'update', icon: RefreshCw, label: 'Atualizar' },
]

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('api-keys')
  const [appVersion, setAppVersion] = useState('...')
  const { activeModel, setActiveModel } = useSettingsStore()

  useEffect(() => {
    invoke<string>('get_app_version').then(setAppVersion).catch(() => setAppVersion('?'))
  }, [])

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Configurações</h2>
      </div>

      <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-zinc-800/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all duration-150',
              activeTab === tab.id
                ? 'bg-brand/10 text-zinc-100 border border-brand/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'api-keys' && <ApiKeysSection />}
        {activeTab === 'models' && (
          <ModelsSection activeModel={activeModel} onModelChange={setActiveModel} />
        )}
        {activeTab === 'plugins' && <PluginManager />}
        {activeTab === 'subagents' && <SubagentManagerSection />}
        {activeTab === 'mcp' && <McpServersSection />}
        {activeTab === 'github' && <GitHubSection />}
        {activeTab === 'supabase' && <SupabaseSection />}
        {activeTab === 'update' && <UpdateSection />}
      </div>

      <div className="px-4 py-2 border-t border-zinc-800/50">
        <span className="text-[10px] text-zinc-700">v{appVersion}</span>
      </div>
    </div>
  )
}
