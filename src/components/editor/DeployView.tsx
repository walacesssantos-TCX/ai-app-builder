import { useState, useEffect } from 'react'
import { Rocket, Globe, Server, ExternalLink, RefreshCw, Play, StopCircle, CheckCircle, XCircle, Loader, Plus, Trash2, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, type DeploymentDto } from '@/lib/api'

const platformIcons: Record<string, typeof Globe> = {
  vercel: Globe,
  netlify: Server,
  docker: Server,
  custom: Rocket,
}

const statusConfig: Record<string, { icon: typeof Loader; color: string; label: string }> = {
  created: { icon: StopCircle, color: 'text-zinc-500', label: 'Criado' },
  building: { icon: Loader, color: 'text-gold-400', label: 'Compilando' },
  built: { icon: CheckCircle, color: 'text-gold-400', label: 'Compilado' },
  deployed: { icon: CheckCircle, color: 'text-gold-400', label: 'Implantado' },
  error: { icon: XCircle, color: 'text-brand-400', label: 'Erro' },
}

export function DeployView() {
  const [deploys, setDeploys] = useState<DeploymentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDeploy, setSelectedDeploy] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newPlatform, setNewPlatform] = useState('vercel')
  const [building, setBuilding] = useState<string | null>(null)
  const [buildLog, setBuildLog] = useState<string | null>(null)

  const loadDeploys = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.deploy.list()
      setDeploys(data)
    } catch (e) {
      setError('Sidecar offline ou erro de rede.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDeploys() }, [])

  const handleCreate = async () => {
    if (!newName.trim() || !newPath.trim()) return
    setError('')
    try {
      await api.deploy.create({ name: newName.trim(), projectPath: newPath.trim(), platform: newPlatform })
      setNewName('')
      setNewPath('')
      setNewPlatform('vercel')
      setShowNew(false)
      await loadDeploys()
    } catch (e) {
      setError(`Falha ao criar deploy: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleBuild = async (id: string) => {
    setBuilding(id)
    setBuildLog(null)
    setError('')
    try {
      const result = await api.deploy.build(id)
      setBuildLog(result.log)
      if (!result.success) setError('Build falhou — veja o log abaixo.')
      await loadDeploys()
    } catch (e) {
      setError(`Falha ao iniciar build: ${e instanceof Error ? e.message : e}`)
    } finally {
      setBuilding(null)
    }
  }

  const handleDelete = async (id: string) => {
    setError('')
    try {
      await api.deploy.delete(id)
      setDeploys(prev => prev.filter(d => d.id !== id))
      if (selectedDeploy === id) setSelectedDeploy(null)
    } catch (e) {
      setError(`Falha ao excluir deploy: ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-gold-400" /> Deploys
          </h2>
          <p className="text-[11px] text-zinc-600">Compile e gerencie deploys dos seus projetos.</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {showNew && (
        <div className="px-4 pt-3 pb-2 border-b border-zinc-800/50 space-y-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do deploy (ex: production)"
            className="w-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 outline-none placeholder-zinc-600"
          />
          <input
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            placeholder="Caminho do projeto"
            className="w-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 outline-none placeholder-zinc-600"
          />
          <select
            value={newPlatform}
            onChange={e => setNewPlatform(e.target.value)}
            className="w-full bg-zinc-900 text-zinc-100 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 outline-none"
          >
            <option value="vercel">Vercel</option>
            <option value="netlify">Netlify</option>
            <option value="docker">Docker</option>
            <option value="custom">Custom</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!newName.trim() || !newPath.trim()}
              className="px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            >Criar</button>
            <button onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >Cancelar</button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {error && (
          <div className="text-xs text-brand-400 bg-brand-900/30 border border-brand-800/30 rounded-lg px-3 py-2">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-5 h-5 text-zinc-600 animate-spin" />
          </div>
        ) : deploys.length === 0 ? (
          <div className="text-center py-12">
            <Rocket className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhum deploy configurado.</p>
            <p className="text-xs text-zinc-700 mt-1">Clique em "Novo" para começar.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {deploys.map(dep => {
              const StatusIcon = statusConfig[dep.status]?.icon || StopCircle
              const PlatformIcon = platformIcons[dep.platform] || Rocket
              const isSelected = selectedDeploy === dep.id

              return (
                <div key={dep.id}>
                  <div
                    onClick={() => setSelectedDeploy(isSelected ? null : dep.id)}
                    className={cn(
                      'bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-colors',
                      isSelected ? 'border-brand-700' : 'border-zinc-800 hover:border-zinc-700'
                    )}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <PlatformIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-200">{dep.name}</span>
                              {statusConfig[dep.status] && (
                                <>
                                  <StatusIcon className={cn('w-3.5 h-3.5', statusConfig[dep.status].color)} />
                                  <span className={cn('text-[10px]', statusConfig[dep.status].color)}>
                                    {statusConfig[dep.status].label}
                                  </span>
                                </>
                              )}
                            </div>
                            {dep.url && (
                              <a href={dep.url} target="_blank" rel="noopener noreferrer"
                                className="text-[11px] text-gold-500 hover:text-gold-400 font-mono mt-0.5 block truncate"
                                onClick={e => e.stopPropagation()}
                              >
                                {dep.url} <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {dep.branch && (
                            <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{dep.branch}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-700">
                        <span>{dep.platform}</span>
                        <span>·</span>
                        <span>Atualizado: {new Date(dep.updatedAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="px-4 pb-3 pt-2 -mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBuild(dep.id)}
                          disabled={building === dep.id || dep.status === 'building'}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
                        >
                          {building === dep.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Compilar
                        </button>
                        <button
                          onClick={() => handleDelete(dep.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-brand/20 hover:bg-brand/40 text-brand-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>

                      {buildLog && (
                        <div className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1">
                            <Terminal className="w-3 h-3" /> Log da build
                          </div>
                          <pre className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap">{buildLog}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={loadDeploys}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Recarregar
        </button>
      </div>
    </div>
  )
}
