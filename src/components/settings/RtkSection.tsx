import { useState, useEffect } from 'react'
import { Cpu, Zap, CheckCircle2, XCircle } from 'lucide-react'

const BASE = 'http://127.0.0.1:3001'

export function RtkSection() {
  const [status, setStatus] = useState<{ available: boolean; savedTokens: number } | null>(null)

  useEffect(() => {
    const check = () => {
      fetch(`${BASE}/rtk-status`)
        .then(r => r.json())
        .then(d => setStatus(d))
        .catch(() => {})
    }
    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-900/30 flex items-center justify-center">
          <Cpu className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-200">RTK — Rust Token Killer</h3>
          <p className="text-[11px] text-zinc-500">Otimizador de tokens via compressão de contexto</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Status</span>
          {status === null ? (
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
              Verificando...
            </span>
          ) : status.available ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ativo
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              Indisponível
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Tokens economizados</span>
          <span className="flex items-center gap-1 text-xs text-gold-400">
            <Zap className="w-3 h-3" />
            {status ? status.savedTokens.toLocaleString() : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Modo de compressão</span>
          <span className="text-xs text-zinc-300">Automático (minimal + aggressive)</span>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          O RTK comprime automaticamente skills ativas, arquivos abertos e histórico de mensagens
          antes de enviá-los ao modelo de linguagem, reduzindo o consumo de tokens sem perder informações essenciais.
        </p>
      </div>
    </div>
  )
}
