import { useState, useMemo } from 'react'
import { useSkillsStore } from '@/stores/skills.store'
import type { ToolDef } from '@/types'

function ToolRow({ tool }: { tool: ToolDef }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-zinc-200">{tool.name}</div>
        <div className="text-xs text-zinc-400 truncate">{tool.description}</div>
      </div>
      <div className="text-xs text-zinc-500 font-mono">{tool.exec}</div>
      {tool.permissions.length > 0 && (
        <div className="flex gap-1">
          {tool.permissions.map(p => (
            <span key={p} className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">{p}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function PluginManager() {
  const available = useSkillsStore(s => s.available)
  const pinned = useSkillsStore(s => s.pinned)
  const pin = useSkillsStore(s => s.pin)
  const unpin = useSkillsStore(s => s.unpin)
  const [search, setSearch] = useState('')

  const pluginSkills = useMemo(() => {
    return available
      .filter(s => s.tools && s.tools.length > 0)
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  }, [available, search])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300">Plugins ({pluginSkills.length})</h3>
      </div>

      <input
        type="text"
        placeholder="Buscar plugins..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 mb-3"
      />

      {pluginSkills.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">
          Nenhum plugin encontrado. Skills com ferramentas (<code>tools</code>) no frontmatter aparecerão aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {pluginSkills.map(skill => {
            const isActive = pinned.includes(skill.name)
            return (
              <div key={skill.name} className={`p-3 rounded-xl border transition-colors ${isActive ? 'border-blue-500/40 bg-blue-500/5' : 'border-zinc-700/50 bg-zinc-800/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm text-zinc-200">{skill.name}</div>
                    <div className="text-xs text-zinc-400 line-clamp-1">{skill.description}</div>
                  </div>
                  <button
                    onClick={() => isActive ? unpin(skill.name) : pin(skill.name)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
                  >
                    {isActive ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                <div className="space-y-1">
                  {skill.tools?.map(tool => <ToolRow key={tool.name} tool={tool} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pluginSkills.length > 0 && (
        <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <h4 className="text-xs font-semibold text-zinc-400 mb-2">Como usar plugins</h4>
          <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
            <li>Ative um plugin clicando em <strong>Ativo</strong></li>
            <li>Vá para o chat e mude para o modo <strong>Agent</strong></li>
            <li>O agente terá acesso às ferramentas do plugin no loop ReAct</li>
            <li>As ferramentas aparecem no prompt de sistema automaticamente</li>
          </ol>
        </div>
      )}
    </div>
  )
}
