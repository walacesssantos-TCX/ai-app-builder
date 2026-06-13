import { Loader2, WifiOff, RefreshCw, Cpu } from 'lucide-react'
import type { SidecarStatus } from '@/hooks/useSidecarStatus'

interface Props {
  status: SidecarStatus
  retryCount: number
  onRetry: () => void
}

const messages: Record<SidecarStatus, { title: string; description: string }> = {
  connecting: {
    title: 'Conectando ao sidecar',
    description: 'Verificando conexão com o servidor...',
  },
  starting: {
    title: 'Iniciando sidecar',
    description: 'Aguardando o servidor de IA ficar disponível...',
  },
  online: {
    title: 'Conectado',
    description: '',
  },
  offline: {
    title: 'Sidecar offline',
    description: 'Não foi possível conectar ao servidor. Verifique se o sidecar está rodando.',
  },
}

export function SidecarLoading({ status, retryCount, onRetry }: Props) {
  if (status === 'online') return null

  const msg = messages[status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        {status === 'offline' ? (
          <div className="w-16 h-16 rounded-full bg-brand-900/30 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-brand-400" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
            {status === 'starting' ? (
              <Cpu className="w-8 h-8 text-gold-400" />
            ) : (
              <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
            )}
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{msg.title}</h2>
          <p className="text-sm text-zinc-500 mt-1">{msg.description}</p>
        </div>

        {status === 'connecting' && retryCount > 1 && (
          <p className="text-xs text-zinc-600">Tentativa {retryCount}/{30}</p>
        )}

        {status === 'offline' && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}
