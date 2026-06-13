import { useState, useRef, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, Maximize2, Minimize2, Smartphone, Monitor, Play, Square, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface PreviewerProps {
  projectPath?: string
}

type DeviceMode = 'desktop' | 'mobile'
type ServerStatus = 'idle' | 'detecting' | 'starting' | 'running' | 'error'

export function Previewer({ projectPath }: PreviewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [fullscreen, setFullscreen] = useState(false)
  const [serverStatus, setServerStatus] = useState<ServerStatus>('idle')
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [fileChangeCount, setFileChangeCount] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!projectPath) {
      setError('Nenhum projeto aberto. Abra ou crie um projeto para usar o preview.')
      setLoading(false)
      setServerStatus('idle')
      return
    }

    setLoading(true)
    setError('')

    api.preview.status(projectPath).then(({ server }) => {
      if (server?.running && server.port) {
        setServerStatus('running')
        setServerPort(server.port)
        setUrl(`http://localhost:${server.port}`)
        setLoading(false)
        connectSSE(projectPath)
      } else {
        return detectServer(projectPath)
      }
    }).catch(() => detectServer(projectPath))

    return () => {
      eventSourceRef.current?.close()
    }
  }, [projectPath])

  function connectSSE(projectPath: string) {
    eventSourceRef.current?.close()
    const es = new EventSource(`http://127.0.0.1:3001/preview/events?projectPath=${encodeURIComponent(projectPath)}`)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'file_changed' && autoRefresh) {
          setFileChangeCount(c => c + 1)
          handleRefresh()
        }
      } catch {}
    }
    es.onerror = () => {}
    eventSourceRef.current = es
  }

  async function detectServer(projectPath: string) {
    setServerStatus('detecting')
    try {
      const { port } = await api.preview.detect(projectPath)
      if (port) {
        setServerPort(port)
        setUrl(`http://localhost:${port}`)
        setServerStatus('running')
        setLoading(false)
        connectSSE(projectPath)
      } else {
        setServerStatus('idle')
        setError('Nenhum servidor de desenvolvimento detectado. Inicie o servidor manualmente ou clique em "Iniciar".')
        setLoading(false)
      }
    } catch {
      setServerStatus('idle')
      setError('Erro ao detectar servidor.')
      setLoading(false)
    }
  }

  async function handleStartServer() {
    if (!projectPath) return
    setServerStatus('starting')
    setError('')
    setLoading(true)
    try {
      const info = await api.preview.start(projectPath)
      if (info.port) {
        setServerPort(info.port)
        setUrl(`http://localhost:${info.port}`)
        setServerStatus('running')
        setLoading(false)
        connectSSE(projectPath)
      } else {
        setServerStatus('error')
        setError('Servidor iniciou mas não foi possível detectar a porta. Verifique os logs.')
        setLoading(false)
      }
    } catch (err) {
      setServerStatus('error')
      setError(`Falha ao iniciar servidor: ${(err as Error).message}`)
      setLoading(false)
    }
  }

  async function handleStopServer() {
    if (!projectPath) return
    try {
      await api.preview.stop(projectPath)
    } catch {}
    setServerStatus('idle')
    setServerPort(null)
    setUrl('')
    setError('Servidor parado.')
  }

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src
      iframeRef.current.src = ''
      setTimeout(() => { iframeRef.current!.src = currentSrc }, 50)
    }
  }, [])

  const handleOpenExternal = useCallback(() => {
    if (url) window.open(url, '_blank')
  }, [url])

  if (!projectPath) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <Eye className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-600 leading-relaxed">
            Nenhum projeto aberto.<br />
            Abra ou crie um projeto para usar o preview.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', fullscreen && 'fixed inset-0 z-50 bg-zinc-950')}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Recarregar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="flex bg-zinc-900 rounded-md p-0.5">
            <button
              onClick={() => setDevice('desktop')}
              className={cn('p-1 rounded transition-colors', device === 'desktop' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}
              title="Desktop"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={cn('p-1 rounded transition-colors', device === 'mobile' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}
              title="Mobile (375px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {serverStatus === 'idle' && (
            <button
              onClick={handleStartServer}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-brand-600/40 text-gold-300 hover:bg-brand-600/60 transition-colors"
              title="Iniciar servidor de desenvolvimento"
            >
              <Play className="w-3 h-3" /> Iniciar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {fileChangeCount > 0 && autoRefresh && (
            <span className="text-[10px] text-zinc-600">{fileChangeCount} alterações</span>
          )}

          {serverStatus === 'running' && serverPort && (
            <span className="text-[10px] font-mono text-gold-500/60">:{serverPort}</span>
          )}

          {serverStatus === 'starting' && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <RefreshCw className="w-3 h-3 animate-spin" /> iniciando...
            </span>
          )}

          {serverStatus === 'running' && (
            <button
              onClick={handleStopServer}
              className="p-1 rounded hover:bg-zinc-800 text-brand-400 hover:text-red-300 transition-colors"
              title="Parar servidor"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}

          {url && (
            <button
              onClick={handleOpenExternal}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Abrir no navegador"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-zinc-900 min-h-0 p-2">
        {loading || serverStatus === 'starting' ? (
          <div className="flex flex-col items-center gap-2">
            {serverStatus === 'starting' ? (
              <>
                <RefreshCw className="w-5 h-5 text-gold-500 animate-spin" />
                <p className="text-xs text-zinc-500">Iniciando servidor...</p>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
                <p className="text-xs text-zinc-600">Detectando servidor...</p>
              </>
            )}
          </div>
        ) : error ? (
          <div className="text-center p-4 max-w-sm">
            <p className="text-xs text-zinc-500 mb-2">{error}</p>
            {serverStatus === 'idle' && (
              <button
                onClick={handleStartServer}
                className="flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Iniciar Servidor
              </button>
            )}
          </div>
        ) : url ? (
          <div
            className={cn(
              'bg-white rounded-lg overflow-hidden shadow-2xl transition-all',
              device === 'mobile' ? 'w-[375px]' : 'w-full h-full'
            )}
          >
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
