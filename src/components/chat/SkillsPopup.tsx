import { useState, useEffect, useRef } from 'react'
import { Search, X, Check, Puzzle } from 'lucide-react'
import { useSkillsStore } from '@/stores/skills.store'
import { BUILTIN_SKILLS, SKILL_CATEGORIES } from '@/data/builtinSkills'
import { cn } from '@/lib/utils'

interface SkillsPopupProps {
  open: boolean
  onClose: () => void
}

export function SkillsPopup({ open, onClose }: SkillsPopupProps) {
  const { pinned, pin, unpin } = useSkillsStore()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setSelected([...pinned])
      setSearch('')
    }
  }, [open, pinned])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const filtered = BUILTIN_SKILLS.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q)
    )
  })

  const grouped = SKILL_CATEGORIES.map(cat => ({
    category: cat,
    skills: filtered.filter(s => s.category === cat),
  })).filter(g => g.skills.length > 0)

  const toggle = (name: string) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const handleConfirm = () => {
    // Unpin all, then pin selected
    pinned.forEach(n => unpin(n))
    selected.forEach(n => pin(n))
    onClose()
  }

  const totalSelected = selected.length

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-[520px] max-h-[80vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
              <Puzzle className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Skills</h2>
              <p className="text-[11px] text-zinc-500">
                {totalSelected} selecionada{totalSelected !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-zinc-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar skills..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand/50 transition-colors"
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {grouped.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">Nenhuma skill encontrada</p>
          )}
          {grouped.map(({ category, skills }) => (
            <div key={category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {skills.map(skill => {
                  const isSelected = selected.includes(skill.name)
                  return (
                    <button
                      key={skill.name}
                      onClick={() => toggle(skill.name)}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                        isSelected
                          ? 'bg-brand/10 border border-brand/30'
                          : 'hover:bg-zinc-800/50 border border-transparent'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                        isSelected
                          ? 'bg-brand border-brand'
                          : 'border-zinc-600'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-sm font-medium truncate',
                            isSelected ? 'text-brand' : 'text-zinc-200'
                          )}>
                            {skill.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {skill.description}
                        </p>
                        {skill.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {skill.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0 mt-1">
                        P{skill.priority}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">
            Skills ativas na conversa
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 text-sm font-medium rounded-xl bg-brand hover:bg-brand-600 text-white transition-colors"
            >
              Ativar {totalSelected > 0 && `(${totalSelected})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
