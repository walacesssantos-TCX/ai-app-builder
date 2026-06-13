import { useState, useEffect } from 'react'
import { Database, Plus, Trash2, Power, PowerOff, Plug, CheckCircle2, XCircle, RefreshCw, Table2, HardDrive, Users } from 'lucide-react'
import { api, type SupabaseConnectionDto, type SupabaseStatusDto } from '@/lib/api'

export function SupabaseSection() {
  const [connections, setConnections] = useState<SupabaseConnectionDto[]>([])
  const [statuses, setStatuses] = useState<Map<string, SupabaseStatusDto>>(new Map())
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; project?: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<{
    tables?: { schema: string; name: string }[]
    buckets?: any[]
    users?: any[]
  } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    loadConnections()
  }, [])

  async function loadConnections() {
    try {
      const [conns, st] = await Promise.all([
        api.supabase.list(),
        api.supabase.status(),
      ])
      setConnections(conns)
      setStatuses(new Map(st.map(s => [s.id, s])))
    } catch {
      setError('Sidecar offline')
    }
  }

  async function handleTest() {
    if (!name.trim() || !url.trim() || !anonKey.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.supabase.testConnection({
        name: name.trim(),
        url: url.trim(),
        anonKey: anonKey.trim(),
        serviceKey: serviceKey.trim() || undefined,
      })
      setTestResult(result)
    } catch {
      setTestResult({ success: false, error: 'Erro ao testar conexão' })
    } finally {
      setTesting(false)
    }
  }

  async function handleAdd() {
    if (!name.trim() || !url.trim() || !anonKey.trim()) return
    setError('')
    try {
      const created = await api.supabase.create({
        name: name.trim(),
        url: url.trim(),
        anonKey: anonKey.trim(),
        serviceKey: serviceKey.trim() || undefined,
      })
      setConnections(prev => [...prev, created])
      setName('')
      setUrl('')
      setAnonKey('')
      setServiceKey('')
      setShowAdd(false)
      setTestResult(null)
    } catch {
      setError('Falha ao adicionar conexão.')
    }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      await api.supabase.delete(id)
      setConnections(prev => prev.filter(s => s.id !== id))
    } catch {
      setError('Falha ao excluir conexão.')
    }
  }

  async function handleToggle(id: string) {
    setError('')
    try {
      const result = await api.supabase.toggle(id)
      setConnections(prev => prev.map(s => s.id === id ? { ...s, enabled: result.enabled } : s))
      await loadConnections()
    } catch {
      setError('Falha ao alternar conexão.')
    }
  }

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedData(null)
      return
    }
    setExpandedId(id)
    setLoadingDetails(true)
    setExpandedData(null)
    try {
      const [tables, buckets, users] = await Promise.all([
        api.supabase.tables(id).catch(() => ({ tables: [] })),
        api.supabase.buckets(id).catch(() => ({ buckets: [] })),
        api.supabase.authUsers(id).catch(() => ({ users: [] })),
      ])
      setExpandedData({ tables: tables.tables, buckets: buckets.buckets, users: users.users })
    } catch {
      setExpandedData({})
    } finally {
      setLoadingDetails(false)
    }
  }

  const stat = (id: string) => statuses.get(id)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-gold-400" /> Supabase
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Conectar
        </button>
      </div>

      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome da conexão"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500"
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="URL do projeto (ex: https://abc123.supabase.co)"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
          />
          <input
            value={anonKey}
            onChange={e => setAnonKey(e.target.value)}
            placeholder="Anon Key (pública)"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
          />
          <input
            value={serviceKey}
            onChange={e => setServiceKey(e.target.value)}
            placeholder="Service Role Key (opcional — para admin)"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
          />

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !name.trim() || !url.trim() || !anonKey.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 disabled:opacity-40 transition-colors"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
              Testar
            </button>
            <button
              onClick={handleAdd}
              disabled={!name.trim() || !url.trim() || !anonKey.trim()}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => { setShowAdd(false); setTestResult(null) }}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >
              Cancelar
            </button>
          </div>

          {testResult && (
            <div className={`flex items-center gap-1.5 text-xs ${testResult.success ? 'text-gold-400' : 'text-brand-400'} bg-zinc-800/50 rounded px-2.5 py-1.5`}>
              {testResult.success ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Conectado{testResult.project ? ` — ${testResult.project}` : ''}</>
              ) : (
                <><XCircle className="w-3.5 h-3.5" /> {testResult.error}</>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-brand-400 bg-brand-900/30 border border-brand-800/30 rounded-lg px-3 py-2">{error}</div>
      )}

      {connections.length === 0 && !showAdd ? (
        <p className="text-xs text-zinc-600">Nenhuma conexão Supabase configurada.</p>
      ) : (
        <div className="space-y-1.5">
          {connections.map(s => {
            const st = stat(s.id)
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => s.enabled && handleExpand(s.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-200">{s.name}</span>
                      {st ? (
                        st.connected ? (
                          <span className="flex items-center gap-1 text-[10px] text-gold-500">
                            <CheckCircle2 className="w-3 h-3" /> connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-brand-400">
                            <XCircle className="w-3 h-3" /> {st.error || 'offline'}
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-zinc-600">unknown</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 font-mono mt-0.5 truncate">{s.url}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(s.id)}
                      className={`p-1.5 rounded transition-colors ${
                        s.enabled ? 'text-gold-400 hover:bg-zinc-800' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {s.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-brand-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {expandedId === s.id && (
                  <div className="bg-zinc-900/80 border border-zinc-800/50 border-t-0 rounded-b-lg px-3 py-2 space-y-2">
                    {loadingDetails ? (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando...
                      </div>
                    ) : expandedData ? (
                      <>
                        <div>
                          <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5">
                            <Table2 className="w-3 h-3" /> Tabelas
                          </h4>
                          {expandedData.tables && expandedData.tables.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {expandedData.tables.map(t => (
                                <span key={t.name} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-600">Nenhuma tabela encontrada</p>
                          )}
                        </div>

                        <div>
                          <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5">
                            <HardDrive className="w-3 h-3" /> Storage Buckets
                          </h4>
                          {expandedData.buckets && expandedData.buckets.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {expandedData.buckets.map((b: any) => (
                                <span key={b.id || b.name} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                                  {b.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-600">Nenhum bucket encontrado</p>
                          )}
                        </div>

                        <div>
                          <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5">
                            <Users className="w-3 h-3" /> Usuários Auth
                          </h4>
                          {expandedData.users && expandedData.users.length > 0 ? (
                            <p className="text-[10px] text-zinc-500">{expandedData.users.length} usuário(s) cadastrado(s)</p>
                          ) : (
                            <p className="text-[10px] text-zinc-600">Nenhum usuário encontrado</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-brand-400">Erro ao carregar dados</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
