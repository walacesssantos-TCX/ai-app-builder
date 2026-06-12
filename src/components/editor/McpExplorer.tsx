import { useState } from 'react'
import { Boxes, Plus, Trash2, Power, PowerOff, Wrench, Plug, Globe, Terminal, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, type McpServerDto } from '@/lib/api'
import { useEffect } from 'react'

const TRANSPORTS = ['stdio', 'http', 'sse', 'ws'] as const

const transportIcon: Record<string, typeof Terminal> = {
  stdio: Terminal,
  http: Globe,
  sse: Server,
  ws: Plug,
}

export function McpExplorer() {
  const [servers, setServers] = useState<McpServerDto[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<string>('stdio')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.mcpServers.list().then(setServers).catch(() => setError('Sidecar offline')).finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!name.trim()) return
    setError('')
    try {
      const data: Record<string, string | undefined> = { name: name.trim(), transport }
      if (transport === 'stdio') {
        data.command = command.trim() || undefined
        data.args = args.trim() || undefined
      } else {
        data.url = url.trim() || undefined
      }
      const created = await api.mcpServers.create(data as { name: string; transport: string })
      setServers(prev => [...prev, created])
      setName('')
      setCommand('')
      setArgs('')
      setUrl('')
      setShowAdd(false)
    } catch {
      setError('Falha ao adicionar servidor.')
    }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      await api.mcpServers.delete(id)
      setServers(prev => prev.filter(s => s.id !== id))
    } catch {
      setError('Falha ao excluir servidor.')
    }
  }

  async function handleToggle(id: string) {
    setError('')
    try {
      const result = await api.mcpServers.toggle(id)
      setServers(prev => prev.map(s => s.id === id ? { ...s, enabled: result.enabled } : s))
    } catch {
      setError('Falha ao alternar servidor.')
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-emerald-400" /> MCP Servers
          </h2>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        <p className="text-[11px] text-zinc-600">Gerencie servidores MCP para estender as capacidades do agente.</p>
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</div>
        )}

        {showAdd && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-medium text-zinc-300">Novo Servidor MCP</h3>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do servidor"
              className="w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-2 rounded border border-zinc-700 outline-none placeholder-zinc-500"
            />
            <select
              value={transport}
              onChange={e => setTransport(e.target.value)}
              className="w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-2 rounded border border-zinc-700 outline-none"
            >
              {TRANSPORTS.map(t => {
                const label = t === 'stdio' ? 'Subprocesso' : t === 'http' ? 'HTTP' : t === 'sse' ? 'Server-Sent Events' : 'WebSocket'
                return <option key={t} value={t}>{t.toUpperCase()} — {label}</option>
              })}
            </select>
            {transport === 'stdio' ? (
              <>
                <input
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  placeholder="Comando (ex: npx)"
                  className="w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-2 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
                />
                <input
                  value={args}
                  onChange={e => setArgs(e.target.value)}
                  placeholder="Argumentos"
                  className="w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-2 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
                />
              </>
            ) : (
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="URL do servidor"
                className="w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-2 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
              />
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={!name.trim()}
                className="flex-1 px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors"
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

        {loading ? (
          <p className="text-xs text-zinc-600">Carregando...</p>
        ) : servers.length === 0 && !showAdd ? (
          <div className="text-center py-12">
            <Server className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhum servidor MCP configurado.</p>
            <p className="text-xs text-zinc-700 mt-1">Adicione servidores para conectar ferramentas externas ao agente.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {servers.map(s => {
              const Icon = transportIcon[s.transport] || Wrench
              return (
                <div key={s.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-700 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-200">{s.name}</span>
                      <span className={cn('text-[10px] uppercase px-1.5 py-0.5 rounded font-medium', s.enabled ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-600')}>
                        {s.transport}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 font-mono mt-1 truncate">
                      {s.transport === 'stdio' ? `${s.command || ''} ${s.args || ''}` : s.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(s.id)}
                      className={cn('p-2 rounded transition-colors', s.enabled ? 'text-emerald-400 hover:bg-zinc-800' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800')}
                    >
                      {s.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
