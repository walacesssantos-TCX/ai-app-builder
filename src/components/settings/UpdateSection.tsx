import { useEffect, useState } from 'react'
import { RefreshCw, Download, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; notes?: string; download: () => Promise<void> }
  | { status: 'downloading'; progress: number }
  | { status: 'installed' }
  | { status: 'uptodate' }
  | { status: 'error'; message: string }

interface LocalUpdateInfo {
  version: string
  notes: string
  installer_path: string
}

export function UpdateSection() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    handleCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCheck() {
    setState({ status: 'checking' })
    try {
      const local = await invoke<LocalUpdateInfo | null>('check_local_update')
      if (local) {
        setState({
          status: 'available',
          version: local.version,
          notes: local.notes,
          download: async () => {
            setState({ status: 'downloading', progress: 0 })
            try {
              await invoke('install_update', { path: local.installer_path })
              setState({ status: 'installed' })
            } catch (e) {
              setState({ status: 'error', message: `Falha ao instalar: ${e}` })
            }
          },
        })
        return
      }
      setState({ status: 'uptodate' })
    } catch (err) {
      setState({ status: 'error', message: String(err) })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gold-400" /> Atualizações
        </h3>
        <button
          onClick={handleCheck}
          disabled={state.status === 'checking' || state.status === 'downloading'}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'checking' ? 'animate-spin' : ''}`} />
          Verificar
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        {state.status === 'idle' && (
          <p className="text-xs text-zinc-500">Clique em "Verificar" para buscar atualizações.</p>
        )}

        {state.status === 'checking' && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Verificando atualizações...
          </div>
        )}

        {state.status === 'available' && (
          <>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-gold-400" />
              <span className="text-xs font-medium text-zinc-100">
                v{state.version} disponível
              </span>
            </div>
            {state.notes && (
              <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">{state.notes}</p>
            )}
            <button
              onClick={state.download}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand hover:bg-brand-600 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar & Instalar
            </button>
          </>
        )}

        {state.status === 'downloading' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Download className="w-3.5 h-3.5 animate-pulse" />
              Instalando atualização...
            </div>
          </div>
        )}

        {state.status === 'installed' && (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-zinc-100">
                Instalação concluída!
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Reinicie o aplicativo para usar a nova versão.
            </p>
            <button
              onClick={() => relaunch()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand hover:bg-brand-600 text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar agora
            </button>
          </>
        )}

        {state.status === 'uptodate' && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle className="w-3.5 h-3.5 text-gold-500" />
            Aplicativo está atualizado.
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-start gap-2 text-xs text-brand-400">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
