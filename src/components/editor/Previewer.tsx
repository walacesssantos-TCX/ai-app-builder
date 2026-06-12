import { useState, useRef, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, Maximize2, Minimize2, Smartphone, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreviewerProps {
  projectPath?: string
}

type DeviceMode = 'desktop' | 'mobile'

export function Previewer({ projectPath }: PreviewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!projectPath) {
      setError('Nenhum projeto aberto. Abra ou crie um projeto React/Next.js para usar o preview.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    detectDevServer(projectPath).then(u => {
      if (u) {
        setUrl(u)
      } else {
        setError('Servidor de desenvolvimento não encontrado. Execute npm run dev no terminal.')
      }
    }).catch(() => {
      setError('Erro ao detectar servidor de desenvolvimento.')
    }).finally(() => setLoading(false))
  }, [projectPath])

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
  }, [])

  const handleOpenExternal = useCallback(() => {
    if (url) window.open(url, '_blank')
  }, [url])

  if (!projectPath) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-xs text-zinc-600 text-center leading-relaxed">
          Nenhum projeto aberto.<br />
          Abra ou crie um projeto React/Next.js para usar o preview.
        </p>
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
        </div>
        <div className="flex items-center gap-2">
          {url && (
            <span className="text-[10px] font-mono text-zinc-600 truncate max-w-[200px]">{url}</span>
          )}
          <button
            onClick={handleOpenExternal}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Abrir no navegador"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className={cn('flex-1 flex items-center justify-center bg-zinc-900 min-h-0 p-2')}>
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
            <p className="text-xs text-zinc-600">Detectando servidor...</p>
          </div>
        ) : error ? (
          <div className="text-center p-4">
            <p className="text-xs text-zinc-600 mb-2">{error}</p>
            <p className="text-[11px] text-zinc-700">Certifique-se de que o servidor de desenvolvimento está rodando (ex: npm run dev)</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}

async function detectDevServer(projectPath: string): Promise<string | null> {
  const commonPorts = [1420, 3000, 5173, 5174, 8080, 3001]
  for (const port of commonPorts) {
    try {
      const res = await fetch(`http://localhost:${port}`, { method: 'HEAD', signal: AbortSignal.timeout(800) })
      if (res.ok || res.status === 404) {
        return `http://localhost:${port}`
      }
    } catch {
      continue
    }
  }
  return null
}
