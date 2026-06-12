import { useState } from 'react'
import { Rocket, Globe, Server, ExternalLink, RefreshCw, Play, StopCircle, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Deployment {
  id: string
  name: string
  url: string
  status: 'running' | 'stopped' | 'error' | 'deploying'
  platform: 'vercel' | 'netlify' | 'docker' | 'custom'
  updatedAt: string
  branch?: string
}

const MOCK_DEPLOYS: Deployment[] = [
  { id: '1', name: 'production', url: 'https://app.fluxcodex.dev', status: 'running', platform: 'vercel', updatedAt: '2026-06-09T10:00:00Z', branch: 'main' },
  { id: '2', name: 'staging', url: 'https://staging.fluxcodex.dev', status: 'running', platform: 'vercel', updatedAt: '2026-06-08T22:00:00Z', branch: 'develop' },
  { id: '3', name: 'api', url: 'https://api.fluxcodex.dev', status: 'error', platform: 'docker', updatedAt: '2026-06-07T15:30:00Z' },
]

const platformIcons: Record<string, typeof Globe> = {
  vercel: Globe,
  netlify: Server,
  docker: Server,
  custom: Rocket,
}

const statusConfig: Record<string, { icon: typeof Loader; color: string; label: string }> = {
  running: { icon: CheckCircle, color: 'text-emerald-400', label: 'Ativo' },
  stopped: { icon: StopCircle, color: 'text-zinc-500', label: 'Parado' },
  error: { icon: XCircle, color: 'text-red-400', label: 'Erro' },
  deploying: { icon: Loader, color: 'text-amber-400', label: 'Implantando' },
}

export function DeployView() {
  const [deploys] = useState<Deployment[]>(MOCK_DEPLOYS)
  const [selectedDeploy, setSelectedDeploy] = useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-1">
          <Rocket className="w-4 h-4 text-emerald-400" /> Deploys
        </h2>
        <p className="text-[11px] text-zinc-600">Gerencie deploys dos seus projetos.</p>
      </div>

      <div className="p-4 space-y-3">
        {deploys.length === 0 && (
          <div className="text-center py-12">
            <Rocket className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhum deploy configurado.</p>
            <p className="text-xs text-zinc-700 mt-1">Conecte uma plataforma de deploy para começar.</p>
          </div>
        )}

        <div className="grid gap-3">
          {deploys.map(dep => {
            const StatusIcon = statusConfig[dep.status].icon
            const PlatformIcon = platformIcons[dep.platform] || Rocket
            const isSelected = selectedDeploy === dep.id

            return (
              <div
                key={dep.id}
                onClick={() => setSelectedDeploy(isSelected ? null : dep.id)}
                className={cn(
                  'bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-colors',
                  isSelected ? 'border-emerald-700' : 'border-zinc-800 hover:border-zinc-700'
                )}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <PlatformIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{dep.name}</span>
                          <StatusIcon className={cn('w-3.5 h-3.5', statusConfig[dep.status].color)} />
                          <span className={cn('text-[10px]', statusConfig[dep.status].color)}>{statusConfig[dep.status].label}</span>
                        </div>
                        <a
                          href={dep.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-500 hover:text-emerald-400 font-mono mt-0.5 block truncate"
                          onClick={e => e.stopPropagation()}
                        >
                          {dep.url} <ExternalLink className="w-2.5 h-2.5 inline" />
                        </a>
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

                {isSelected && (
                  <div className="px-4 pb-3 pt-1 border-t border-zinc-800">
                    <div className="flex items-center gap-2 mt-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                        <Play className="w-3.5 h-3.5" /> Implantar
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" /> Recarregar
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
