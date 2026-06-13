import { useState, useEffect } from 'react'
import { Store, Download, Search, Puzzle, Layers, ExternalLink, Loader, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIDECAR_URL = 'http://127.0.0.1:3001'

interface MarketplaceItem {
  id: string
  name: string
  description: string
  type: 'skill' | 'template'
  author: string
  downloads: number
  tags: string[]
  installed: boolean
}

// Built-in marketplace items (can be extended with remote source)
const BUILTIN_ITEMS: MarketplaceItem[] = [
  { id: 'skill-react', name: 'React Expert', description: 'Expert guidance on React, hooks, state management, and performance optimization.', type: 'skill', author: 'Fluxcodex', downloads: 1420, tags: ['react', 'frontend', 'ui'], installed: false },
  { id: 'skill-node', name: 'Node.js Backend', description: 'Build robust Node.js APIs with Express, databases, and authentication.', type: 'skill', author: 'Fluxcodex', downloads: 980, tags: ['node', 'backend', 'api'], installed: false },
  { id: 'skill-python', name: 'Python Data', description: 'Data analysis, visualization, and ML with Python, pandas, and scikit-learn.', type: 'skill', author: 'Fluxcodex', downloads: 760, tags: ['python', 'data', 'ml'], installed: false },
  { id: 'skill-rust', name: 'Rust Systems', description: 'Systems programming with Rust — ownership, lifetimes, concurrency, and unsafe.', type: 'skill', author: 'Fluxcodex', downloads: 530, tags: ['rust', 'systems', 'low-level'], installed: false },
  { id: 'skill-docker', name: 'Docker & DevOps', description: 'Containerization, CI/CD pipelines, Kubernetes, and cloud deployment.', type: 'skill', author: 'Fluxcodex', downloads: 890, tags: ['docker', 'devops', 'cloud'], installed: false },
  { id: 'skill-sql', name: 'SQL & Databases', description: 'SQL queries, database design, indexing, and optimization strategies.', type: 'skill', author: 'Fluxcodex', downloads: 670, tags: ['sql', 'database', 'backend'], installed: false },
  { id: 'template-next', name: 'Next.js App', description: 'Full-stack Next.js 15+ with App Router, auth, database, and Tailwind.', type: 'template', author: 'Fluxcodex', downloads: 2340, tags: ['nextjs', 'react', 'fullstack'], installed: false },
  { id: 'template-express', name: 'Express API', description: 'Production-ready Express REST API with TypeScript, Prisma, and JWT auth.', type: 'template', author: 'Fluxcodex', downloads: 1560, tags: ['express', 'node', 'api'], installed: false },
  { id: 'template-react-vite', name: 'React + Vite', description: 'Modern React SPA with Vite, Zustand, Tailwind, and React Router.', type: 'template', author: 'Fluxcodex', downloads: 1890, tags: ['react', 'vite', 'spa'], installed: false },
  { id: 'template-tauri', name: 'Tauri Desktop', description: 'Cross-platform desktop app with Tauri v2, React, and sidecar.', type: 'template', author: 'Fluxcodex', downloads: 430, tags: ['tauri', 'desktop', 'rust'], installed: false },
]

export function MarketplacePanel() {
  const [items] = useState<MarketplaceItem[]>(BUILTIN_ITEMS)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'skill' | 'template'>('all')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())

  const filtered = items.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some(t => t.includes(q))
      )
    }
    return true
  })

  const handleInstall = async (id: string) => {
    setInstalling(id)
    // Simulate install delay
    await new Promise(r => setTimeout(r, 1200))
    setInstalled(prev => new Set(prev).add(id))
    setInstalling(null)
  }

  const skillCount = items.filter(i => i.type === 'skill').length
  const templateCount = items.filter(i => i.type === 'template').length

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-1">
          <Store className="w-4 h-4 text-gold-400" /> Marketplace
        </h2>
        <p className="text-[11px] text-zinc-600">
          Explore skills e templates da comunidade ({skillCount + templateCount} itens)
        </p>
      </div>

      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar skills e templates..."
            className="w-full bg-zinc-900 text-zinc-100 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-800 outline-none placeholder-zinc-600"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'skill', 'template'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-[10px] px-2.5 py-1 rounded-full border transition-colors',
                filter === f
                  ? 'bg-gold/10 border-gold/40 text-gold-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'skill' ? 'Skills' : 'Templates'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 grid gap-2">
        {filtered.map(item => {
          const isInstalled = installed.has(item.id) || item.installed
          const isInstalling = installing === item.id

          return (
            <div
              key={item.id}
              className={cn(
                'bg-zinc-900 border rounded-lg p-3 transition-colors',
                isInstalled ? 'border-brand-700/40' : 'border-zinc-800 hover:border-zinc-700'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className={cn(
                    'p-1.5 rounded-lg shrink-0 mt-0.5',
                    item.type === 'skill' ? 'bg-blue-deep-800/30 text-gold-400' : 'bg-blue-900/30 text-gold-400'
                  )}>
                    {item.type === 'skill' ? <Puzzle className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{item.name}</span>
                      <span className="text-[10px] uppercase text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{item.type}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                      <span>{item.author}</span>
                      <span>·</span>
                      <span>{item.downloads.toLocaleString()} downloads</span>
                    </div>
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleInstall(item.id)}
                  disabled={isInstalled || isInstalling}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg shrink-0 transition-colors',
                    isInstalled
                      ? 'bg-brand/20 text-gold-400 cursor-default'
                      : isInstalling
                        ? 'bg-zinc-800 text-zinc-400'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  )}
                >
                  {isInstalled ? (
                    <><CheckCircle className="w-3 h-3" /> Instalado</>
                  ) : isInstalling ? (
                    <><Loader className="w-3 h-3 animate-spin" /> Instalando...</>
                  ) : (
                    <><Download className="w-3 h-3" /> Instalar</>
                  )}
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Store className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhum item encontrado</p>
            <p className="text-xs text-zinc-700 mt-1">Tente alterar os filtros ou busca.</p>
          </div>
        )}
      </div>
    </div>
  )
}
