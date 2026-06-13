import { useState } from 'react'
import { PuzzleIcon, Search, ExternalLink, Package, Download, Star, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Extension {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  downloads: number
  rating: number
  installed: boolean
  icon?: string
}

const MOCK_EXTENSIONS: Extension[] = [
  { id: 'tailwind-intellisense', name: 'Tailwind IntelliSense', description: 'Autocomplete e preview para classes Tailwind CSS', author: 'Fluxcodex', version: '1.0.0', category: 'Editor', downloads: 1200, rating: 4.5, installed: true },
  { id: 'github-integration', name: 'GitHub Integration', description: 'Conecte projetos ao GitHub, PRs e issues', author: 'Fluxcodex', version: '0.8.0', category: 'Source Control', downloads: 890, rating: 4.2, installed: false },
  { id: 'figma-import', name: 'Figma Import', description: 'Importe designs do Figma como código React', author: 'Community', version: '0.5.0', category: 'Design', downloads: 540, rating: 3.9, installed: false },
  { id: 'supabase-connector', name: 'Supabase Connector', description: 'Gerencie projetos Supabase diretamente', author: 'Fluxcodex', version: '1.2.0', category: 'Database', downloads: 670, rating: 4.7, installed: false },
  { id: 'docker-manager', name: 'Docker Manager', description: 'Gerencie containers e compose files', author: 'Community', version: '0.3.0', category: 'DevOps', downloads: 310, rating: 3.5, installed: false },
  { id: 'i18n-editor', name: 'i18n Editor', description: 'Editor visual para arquivos de tradução', author: 'Fluxcodex', version: '0.6.0', category: 'Editor', downloads: 210, rating: 4.0, installed: false },
]

const categories = ['Todas', 'Editor', 'Source Control', 'Design', 'Database', 'DevOps']

export function ExtensionsExplorer() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [installedOnly, setInstalledOnly] = useState(false)
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS)
  const [extendedInfo, setExtendedInfo] = useState<Set<string>>(new Set())

  const filtered = extensions.filter(ext => {
    const matchSearch = !search || ext.name.toLowerCase().includes(search.toLowerCase()) || ext.description.toLowerCase().includes(search.toLowerCase())
    const matchCategory = category === 'Todas' || ext.category === category
    const matchInstalled = !installedOnly || ext.installed
    return matchSearch && matchCategory && matchInstalled
  })

  const toggleInstall = (id: string) => {
    setExtensions(prev => prev.map(ext => ext.id === id ? { ...ext, installed: !ext.installed } : ext))
  }

  const toggleInfo = (id: string) => {
    setExtendedInfo(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-1">
          <PuzzleIcon className="w-4 h-4 text-gold-400" /> Extensões
        </h2>
        <p className="text-[11px] text-zinc-600">Instale extensões para adicionar funcionalidades ao Fluxcodex.</p>
      </div>

      <div className="px-4 py-3 border-b border-zinc-800 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar extensões..."
            className="w-full bg-zinc-900 text-zinc-100 text-xs pl-8 pr-3 py-2 rounded-lg border border-zinc-800 outline-none placeholder-zinc-600 focus:border-zinc-700 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] transition-colors',
                category === cat ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              )}
            >
              {cat}
            </button>
          ))}
          <label className="flex items-center gap-1.5 ml-auto text-[11px] text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={installedOnly}
              onChange={e => setInstalledOnly(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700"
            />
            Instaladas
          </label>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhuma extensão encontrada.</p>
          </div>
        )}
        {filtered.map(ext => {
          const showInfo = extendedInfo.has(ext.id)
          return (
            <div key={ext.id} className={cn('bg-zinc-900 border border-zinc-800 rounded-lg transition-colors', ext.installed && 'border-emerald-900/50')}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{ext.name}</span>
                      <span className="text-[10px] text-zinc-600">v{ext.version}</span>
                      {ext.installed && <span className="text-[10px] text-gold-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">Instalada</span>}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">{ext.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-zinc-700">{ext.author}</span>
                      <span className="text-[10px] text-zinc-700 flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-amber-500" /> {ext.rating}</span>
                      <span className="text-[10px] text-zinc-700 flex items-center gap-0.5"><Download className="w-2.5 h-2.5" /> {ext.downloads}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleInfo(ext.id)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                  >
                    {showInfo ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => toggleInstall(ext.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-md transition-colors',
                      ext.installed ? 'bg-zinc-800 text-zinc-400 hover:bg-red-900/30 hover:text-brand-400' : 'bg-brand hover:bg-brand-600 text-white'
                    )}
                  >
                    {ext.installed ? 'Remover' : 'Instalar'}
                  </button>
                </div>
              </div>
              {showInfo && (
                <div className="px-4 pb-3 pt-1 border-t border-zinc-800 mt-1">
                  <div className="text-xs text-zinc-400 space-y-2">
                    <p>{ext.description}</p>
                    <div className="flex gap-4 text-[10px] text-zinc-600">
                      <span>Autor: {ext.author}</span>
                      <span>Versão: {ext.version}</span>
                      <span>Categoria: {ext.category}</span>
                    </div>
                    <button className="flex items-center gap-1 text-gold-400 hover:text-gold-300 text-[11px]">
                      <ExternalLink className="w-3 h-3" /> Ver documentação
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
