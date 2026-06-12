import { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import { useSkillsStore } from '@/stores/skills.store'
import { SkillCard } from './SkillCard'
import { useSkills } from '@/hooks/useSkills'
import { SKILL_CATEGORIES, searchSkills } from '@/data/builtinSkills'
import { cn } from '@/lib/utils'

export function SkillsList() {
  const { available } = useSkillsStore()
  const { pinned, togglePin, loadPersistedPins } = useSkills()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')

  const filtered = useMemo(() => {
    let result = available
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (category !== 'Todas') {
      result = result.filter(s => s.category === category)
    }
    return result
  }, [available, search, category])

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header com busca */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Skills</h2>
          <button
            onClick={loadPersistedPins}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Recarregar
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="w-3 h-3 text-zinc-500 shrink-0" />
          {['Todas', ...SKILL_CATEGORIES].map(cat => (
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

        <p className="text-[11px] text-zinc-600">
          {filtered.length} de {available.length} skills
        </p>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-600">Nenhuma skill encontrada para esta busca.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                isPinned={pinned.includes(skill.name)}
                onTogglePin={() => togglePin(skill.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
