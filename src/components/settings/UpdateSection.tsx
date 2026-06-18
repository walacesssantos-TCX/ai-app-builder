import { useEffect, useState } from 'react'
import { RefreshCw, Download, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; notes?: string; installerPath: string }
  | { status: 'downloading' }
  | { status: 'downloaded'; path: string }
  | { status: 'installing' }
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
          installerPath: local.installer_path,
        })
        return
      }
      setState({ status: 'uptodate' })
    } catch (err) {
      setState({ status: 'error', message: String(err) })
    }
  }

  async function handleDownload() {
    if (state.status !== 'available') return
    setState({ status: 'downloading' })
    try {
      const localPath = await invoke<string>('install_update', { path: state.installerPath })
      setState({ status: 'downloaded', path: localPath })
    } catch (e) {
      setState({ status: 'error', message: String(e) })
    }
  }

  async function handleInstallAndRestart() {
    if (state.status !== 'downloaded') return
    setState({ status: 'installing' })
    try {
      await invoke('run_installer', { path: state.path })
      // Installer was spawned with /S /RUN — it will auto-close the app
      // and launch the new version. No need to call relaunch().
    } catch (e) {
      setState({ status: 'error', message: String(e) })
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
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand hover:bg-brand-600 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar atualização
            </button>
          </>
        )}

        {state.status === 'downloading' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Download className="w-3.5 h-3.5 animate-pulse" />
              Baixando atualização...
            </div>
          </div>
        )}

        {state.status === 'downloaded' && (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-zinc-100">
                Download concluído!
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Reinicie o aplicativo para instalar a nova versão.
            </p>
            <button
              onClick={handleInstallAndRestart}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md bg-brand hover:bg-brand-600 text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar e instalar
            </button>
          </>
        )}

        {state.status === 'installing' && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            Instalando e reiniciando...
          </div>
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
