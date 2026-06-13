import { useState, useEffect, useCallback } from 'react'
import { Database, Table, ChevronDown, ChevronRight, Play, RefreshCw, Terminal, Columns, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface TableInfo {
  name: string
  columns: { name: string; type: string; notNull: boolean; pk: boolean }[]
  rowCount: number
}

interface QueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  executionTime: number
}

interface DbFile {
  path: string
  name: string
}

export function DatabaseExplorer({ projectPath }: { projectPath?: string }) {
  const [dbs, setDbs] = useState<DbFile[]>([])
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [tables, setTables] = useState<TableInfo[]>([])
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [sqlInput, setSqlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTable, setActiveTable] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) return
    setLoading(true)
    api.database.listDbs(projectPath)
      .then(res => setDbs(res.databases.map(f => ({ path: `${projectPath}\\${f}`, name: f }))))
      .catch(() => setError('Sidecar offline'))
      .finally(() => setLoading(false))
  }, [projectPath])

  const loadTables = useCallback(async (dbPath: string) => {
    setSelectedDb(dbPath)
    setActiveTable(null)
    setQueryResult(null)
    setError('')
    setLoading(true)
    try {
      const res = await api.database.tables(dbPath)
      setTables(res.tables)
    } catch {
      setError('Falha ao ler tabelas')
    } finally {
      setLoading(false)
    }
  }, [])

  const queryTable = useCallback(async (table: string) => {
    if (!selectedDb) return
    setActiveTable(table)
    setError('')
    try {
      const res = await api.database.query(selectedDb, table, 100)
      setQueryResult(res)
    } catch {
      setError('Falha ao consultar tabela')
    }
  }, [selectedDb])

  const executeSql = useCallback(async () => {
    if (!selectedDb || !sqlInput.trim()) return
    setError('')
    setActiveTable(null)
    try {
      const res = await api.database.execute(selectedDb, sqlInput.trim())
      setQueryResult(res)
    } catch {
      setError('Falha ao executar SQL')
    }
  }, [selectedDb, sqlInput])

  const toggleTable = useCallback((name: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  if (!projectPath) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-xs text-zinc-600 text-center">Nenhum projeto aberto.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-400 flex items-center gap-2">
            <Database className="w-3.5 h-3.5" /> Databases
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {dbs.length === 0 && !loading && (
            <p className="text-[11px] text-zinc-600 px-2 pt-2">Nenhum arquivo .db encontrado no projeto.</p>
          )}
          {dbs.map(db => (
            <div key={db.path}>
              <button
                onClick={() => loadTables(db.path)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                  selectedDb === db.path ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                )}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{db.name}</span>
              </button>
              {selectedDb === db.path && tables.length > 0 && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {tables.map(t => (
                    <div key={t.name}>
                      <button
                        onClick={() => { toggleTable(t.name); queryTable(t.name) }}
                        className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
                      >
                        {expandedTables.has(t.name) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <Table className="w-3 h-3" />
                        <span className="truncate">{t.name}</span>
                        <span className="text-[10px] text-zinc-700 ml-auto">{t.rowCount}</span>
                      </button>
                      {expandedTables.has(t.name) && (
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {t.columns.map(col => (
                            <div key={col.name} className="flex items-center gap-1.5 px-2 py-0.5">
                              <Columns className="w-2.5 h-2.5 text-zinc-700" />
                              <span className="text-[10px] text-zinc-600">{col.name}</span>
                              <span className="text-[9px] text-zinc-700">{col.type}</span>
                              {col.pk && <span className="text-[9px] text-amber-500">PK</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 px-2 py-2">
              <Loader className="w-3 h-3 text-zinc-500 animate-spin" />
              <span className="text-xs text-zinc-600">Carregando...</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
          <input
            value={sqlInput}
            onChange={e => setSqlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) executeSql() }}
            placeholder="Executar SQL... (Ctrl+Enter)"
            className="flex-1 bg-zinc-900 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-600 font-mono"
          />
          <button
            onClick={executeSql}
            disabled={!sqlInput.trim() || !selectedDb}
            className="p-1.5 rounded bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            title="Executar SQL"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="p-3">
              <div className="text-xs text-brand-400 bg-brand-900/30 border border-brand-800/30 rounded-lg px-3 py-2">{error}</div>
            </div>
          )}

          {queryResult && (
            <div className="p-2">
              <div className="text-[10px] text-zinc-600 mb-2 px-1">
                {queryResult.rowCount} linha(s) · {queryResult.executionTime}ms
                {activeTable && <span className="ml-2 text-zinc-700">· {activeTable}</span>}
              </div>
              {queryResult.columns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-900">
                        <th className="text-left px-3 py-1.5 text-zinc-400 font-medium border-b border-zinc-800">#</th>
                        {queryResult.columns.map(col => (
                          <th key={col} className="text-left px-3 py-1.5 text-zinc-400 font-medium border-b border-zinc-800 font-mono whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.slice(0, 500).map((row, i) => (
                        <tr key={i} className="hover:bg-zinc-900/50 border-b border-zinc-800/50">
                          <td className="px-3 py-1 text-zinc-600 text-[10px]">{i + 1}</td>
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1 text-zinc-300 whitespace-nowrap">
                              {cell === null ? <span className="text-zinc-700 italic">NULL</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {queryResult.rows.length > 500 && (
                    <p className="text-[10px] text-zinc-600 mt-2 px-1">Mostrando primeiras 500 de {queryResult.rowCount} linhas.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 px-1">Consulta executada com sucesso (0 resultados).</p>
              )}
            </div>
          )}

          {!queryResult && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6">
                <Database className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">Selecione uma tabela ou execute SQL para ver os dados.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
