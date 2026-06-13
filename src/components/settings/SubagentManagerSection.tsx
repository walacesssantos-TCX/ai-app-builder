import { useState, useEffect } from 'react'
import { Bot, Plus, Trash2, Shield, Search, List, Terminal } from 'lucide-react'
import { api, type SubagentDto } from '@/lib/api'

const TOOL_ICONS: Record<string, typeof Shield> = {
  read_file: Search,
  search_files: Search,
  list_dir: List,
  write_file: Terminal,
  run_command: Terminal,
}

export function SubagentManagerSection() {
  const [subagents, setSubagents] = useState<SubagentDto[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [allowedTools, setAllowedTools] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.subagents.list().then(res => setSubagents(res.subagents)).catch(() => setError('Sidecar offline')).finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!name.trim() || !description.trim() || !systemPrompt.trim()) return
    setError('')
    try {
      const created = await api.subagents.create({
        name: name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        allowedTools,
      })
      setSubagents(prev => [...prev, created])
      setName('')
      setDescription('')
      setSystemPrompt('')
      setAllowedTools([])
      setShowAdd(false)
    } catch {
      setError('Falha ao criar subagente.')
    }
  }

  async function handleDelete(name: string) {
    setError('')
    try {
      await api.subagents.delete(name)
      setSubagents(prev => prev.filter(s => s.name !== name))
    } catch {
      setError('Falha ao excluir subagente.')
    }
  }

  function toggleTool(tool: string) {
    setAllowedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    )
  }

  const allToolOptions = ['read_file', 'write_file', 'run_command', 'list_dir', 'search_files']

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" /> Subagentes
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Criar
        </button>
      </div>

      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome (ex: meu-revisor)"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição para o agente principal ver"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500"
          />
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="System prompt do subagente (instruções detalhadas)"
            rows={4}
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500 resize-none"
          />
          <div>
            <p className="text-[10px] text-zinc-500 mb-1.5">Ferramentas permitidas:</p>
            <div className="flex flex-wrap gap-1.5">
              {allToolOptions.map(tool => {
                const Icon = TOOL_ICONS[tool] || Terminal
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                      allowedTools.includes(tool)
                        ? 'bg-violet-900/40 text-violet-300 border border-violet-700/50'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700/30 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {tool}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!name.trim() || !description.trim() || !systemPrompt.trim()}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-brand-400 bg-brand-900/30 border border-brand-800/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Subagentes são agentes especializados que o agente principal pode invocar via <code className="text-violet-400">spawn_subagent</code>.
        Use built-in (revisor, planejador, pesquisador, executor) ou crie os seus.
      </p>

      {subagents.length === 0 && !showAdd ? (
        <p className="text-xs text-zinc-600">{loading ? 'Carregando...' : 'Nenhum subagente disponível.'}</p>
      ) : (
        <div className="space-y-1.5">
          {subagents.map(s => (
            <div key={s.name} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Bot className={`w-3.5 h-3.5 ${s.isBuiltin ? 'text-violet-400' : 'text-gold-400'}`} />
                    <span className="text-xs font-medium text-zinc-200">{s.name}</span>
                    {s.isBuiltin && (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">built-in</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{s.description}</p>
                </div>
                {!s.isBuiltin && (
                  <button
                    onClick={() => handleDelete(s.name)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-brand-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {s.allowedTools.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {s.allowedTools.map(t => {
                    const Icon = TOOL_ICONS[t] || Terminal
                    return (
                      <span key={t} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400">
                        <Icon className="w-2.5 h-2.5" />
                        {t}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
