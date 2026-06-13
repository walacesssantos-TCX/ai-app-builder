import { useState, useEffect } from 'react'
import { Layers, Search, FolderOpen, ArrowRight, Check, ExternalLink, Rocket, Sparkles, Code, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useProjectStore } from '@/stores/project.store'

const CATEGORY_ICONS: Record<string, typeof Rocket> = {
  'Frontend': Code,
  'Backend': Server,
  'Fullstack': Layers,
}

interface TemplateSummary {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  fileCount: number
}

export function TemplatesPanel() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [creating, setCreating] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [destPath, setDestPath] = useState('')
  const { createProject, projects } = useProjectStore()

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    setLoading(true)
    try {
      const list = await api.templates.list()
      setTemplates(list)
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const categories = ['Todas', ...new Set(templates.map(t => t.category))]
  const filtered = templates.filter(t => {
    if (category !== 'Todas' && t.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q))
    }
    return true
  })

  async function handleCreate(templateId: string) {
    setCreating(templateId)
    setProjectName('')
    setDestPath('')
  }

  async function confirmCreate(templateId: string) {
    if (!projectName.trim() || !destPath.trim()) return
    try {
      const result = await api.templates.create(templateId, destPath, {
        projectName: projectName.trim(),
      })

      await createProject(projectName.trim(), destPath)
      setCreating(null)
    } catch (err) {
      console.error('Failed to create from template:', err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Templates</h2>
        </div>
      </div>

      <div className="p-4 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar templates..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'shrink-0 text-[11px] px-2 py-1 rounded-md transition-colors',
                category === cat
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-zinc-600">Carregando templates...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
            <p className="text-sm text-zinc-600">Nenhum template encontrado</p>
            <p className="text-xs text-zinc-700 mt-1">
              {search ? 'Tente alterar sua busca' : 'Novos templates serão adicionados em breve'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(template => {
              const CategoryIcon = CATEGORY_ICONS[template.category] || Layers

              if (creating === template.id) {
                return (
                  <div key={template.id} className="bg-zinc-900 border border-blue-500/30 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-medium text-zinc-100">{template.name}</h3>
                    <div className="space-y-2">
                      <input
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="Nome do projeto"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && confirmCreate(template.id)}
                      />
                      <input
                        value={destPath}
                        onChange={e => setDestPath(e.target.value)}
                        placeholder="Caminho de destino (ex: C:\Users\projetos\meu-app)"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors font-mono"
                        onKeyDown={e => e.key === 'Enter' && confirmCreate(template.id)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => confirmCreate(template.id)}
                        disabled={!projectName.trim() || !destPath.trim()}
                        className={cn(
                          'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          projectName.trim() && destPath.trim()
                            ? 'bg-brand text-white hover:bg-blue-500'
                            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                        )}
                      >
                        <Rocket className="w-3 h-3" /> Criar projeto
                      </button>
                      <button
                        onClick={() => setCreating(null)}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={template.id}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <CategoryIcon className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-zinc-100">{template.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCreate(template.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <ArrowRight className="w-3 h-3" /> Usar
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">{template.category}</span>
                    <span className="text-[10px] text-zinc-600">{template.fileCount} arquivos</span>
                    {template.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
