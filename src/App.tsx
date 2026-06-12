import { useState, useEffect } from 'react'
import { Terminal } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { RightPanel } from '@/components/layout/RightPanel'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { SkillsList } from '@/components/skills/SkillsList'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { McpExplorer } from '@/components/editor/McpExplorer'
import { ExtensionsExplorer } from '@/components/editor/ExtensionsExplorer'
import { DeployView } from '@/components/editor/DeployView'
import { NetworkIndicator } from '@/components/layout/NetworkIndicator'
import { useProjectStore } from '@/stores/project.store'
import { cn } from '@/lib/utils'

function MainContent({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  switch (activeTab) {
    case 'skills':
      return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
          <SkillsList />
        </div>
      )
    case 'mcp':
      return <McpExplorer />
    case 'extensions':
      return <ExtensionsExplorer />
    case 'deploys':
      return <DeployView />
    case 'settings':
      return <SettingsPanel />
    default:
      return <ChatPanel onNavigate={onTabChange} />
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const { loadProjects } = useProjectStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const isMainChat = activeTab === 'chat' || activeTab === 'history'

  return (
    <div className="h-screen w-screen flex bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab)
        if (tab === 'chat' || tab === 'history') setRightPanelOpen(false)
      }} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex min-h-0">
          <MainContent activeTab={activeTab} onTabChange={setActiveTab} />

          {isMainChat && (
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-zinc-900 border border-zinc-800 rounded-l-md px-1 py-4 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              {'<'}
            </button>
          )}

          <RightPanel
            open={rightPanelOpen && isMainChat}
            onClose={() => setRightPanelOpen(false)}
          />
        </div>

        {isMainChat && !terminalOpen && (
          <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900">
            <button
              onClick={() => setTerminalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs',
                'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors'
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              Terminal
            </button>
            <NetworkIndicator />
          </div>
        )}

        {terminalOpen && (
          <TerminalPanel onClose={() => setTerminalOpen(false)} />
        )}
      </div>
    </div>
  )
}
