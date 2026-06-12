import { useState } from 'react'
import { useProjectStore } from '@/stores/project.store'
import { cn } from '@/lib/utils'
import { FileCode, Code, Eye, ScrollText, Database, X } from 'lucide-react'
import { FileExplorer } from '@/components/editor/FileExplorer'
import { EditorPanel } from '@/components/editor/EditorPanel'
import { Previewer } from '@/components/editor/Previewer'
import { LogsViewer } from '@/components/editor/LogsViewer'
import { DatabaseExplorer } from '@/components/editor/DatabaseExplorer'

const tabs = [
  { id: 'files', icon: FileCode, label: 'Files' },
  { id: 'code', icon: Code, label: 'Code' },
  { id: 'preview', icon: Eye, label: 'Preview' },
  { id: 'logs', icon: ScrollText, label: 'Logs' },
  { id: 'database', icon: Database, label: 'Database' },
]

interface RightPanelProps {
  open: boolean
  onClose: () => void
}

export function RightPanel({ open, onClose }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState('files')
  const { activeProject } = useProjectStore()

  if (!open) return null

  const isCodeActive = activeTab === 'code'

  return (
    <div className={cn('h-full bg-zinc-950 border-l border-zinc-800 flex flex-col', isCodeActive ? 'flex-1' : 'w-80')}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                activeTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'files' && (
          <FileExplorer />
        )}
        {activeTab === 'code' && (
          <EditorPanel />
        )}
        {activeTab === 'preview' && (
          <Previewer projectPath={activeProject?.path} />
        )}
        {activeTab === 'logs' && (
          <LogsViewer />
        )}
        {activeTab === 'database' && (
          <DatabaseExplorer projectPath={activeProject?.path} />
        )}
      </div>
    </div>
  )
}
