import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

interface NetworkStatus {
  online: boolean
  latency: number | null
  error: string | null
}

export function NetworkIndicator() {
  const [status, setStatus] = useState<NetworkStatus | null>(null)

  useEffect(() => {
    const check = async () => {
      setStatus({
        online: navigator.onLine,
        latency: null,
        error: navigator.onLine ? null : 'Sem conexão com a internet',
      })
    }

    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [])

  if (!status) return null

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      title={status.online ? `Online (${status.latency}ms)` : `Offline: ${status.error || 'Sem internet'}`}
    >
      {status.online ? (
        <Wifi className="w-3 h-3 text-gold-500" />
      ) : (
        <WifiOff className="w-3 h-3 text-brand-400" />
      )}
      <span className={`text-[10px] ${status.online ? 'text-emerald-600/70' : 'text-brand-400/70'}`}>
        {status.online ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}
