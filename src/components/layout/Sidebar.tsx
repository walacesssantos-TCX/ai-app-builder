import { useState } from 'react'
import {
  FolderOpen,
  History,
  Puzzle,
  Boxes,
  PuzzleIcon,
  Rocket,
  Settings,
  ChevronLeft,
  Plus,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project.store'

const navItems = [
  { id: 'projects', icon: FolderOpen, label: 'Projetos' },
  { id: 'history', icon: History, label: 'Histórico' },
  { id: 'skills', icon: Puzzle, label: 'Skills' },
  { id: 'mcp', icon: Boxes, label: 'MCP Servers' },
  { id: 'extensions', icon: PuzzleIcon, label: 'Extensões' },
  { id: 'deploys', icon: Rocket, label: 'Deploys' },
  { id: 'settings', icon: Settings, label: 'Configurações' },
]

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { projects, setActiveProject, createProject, deleteProject } = useProjectStore()

  const handleNewProject = () => {
    createProject(`Projeto ${projects.length + 1}`, '')
  }

  return (
    <div
      className={cn(
        'h-full bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        {!collapsed && (
          <img src="/logo.png" alt="Fluxcodex" className="h-7 w-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              activeTab === item.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
            title={item.label}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Projetos</span>
            <button
              onClick={handleNewProject}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group flex items-center gap-1 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                onClick={() => setActiveProject(project)}
              >
                <MessageSquare className="w-3 h-3 shrink-0" />
                <span className="flex-1 truncate">{project.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteProject(project.id) }}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all"
                  title="Remover projeto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-zinc-600 px-2">Nenhum projeto ainda</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
