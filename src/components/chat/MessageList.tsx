import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { MessageBubble } from './MessageBubble'
import { Loader2, Baseline, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MessageList() {
  const { messages, isStreaming, streamingContent, mode, agentEvents, isAgentRunning, compact, totalTokens } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [rtkOn, setRtkOn] = useState(false)
  const [rtkSaved, setRtkSaved] = useState(0)

  useEffect(() => {
    const check = () => {
      fetch('http://localhost:3001/rtk-status')
        .then(r => r.json())
        .then(d => { setRtkOn(d.available); setRtkSaved(d.savedTokens || 0) })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, agentEvents])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src="/logo.png" alt="Fluxcodex" className="h-16 w-auto mx-auto opacity-80" />
          <h2 className="text-lg font-semibold text-zinc-400">AI App Builder Studio</h2>
          <p className="text-sm text-zinc-600 max-w-md">
            Converse com a IA para desenvolver software completo.
            Use o botão <strong>+</strong> para adicionar skills, contexto ou uploads.
          </p>
          <p className="text-[10px] text-zinc-700">
            Digite <code className="text-emerald-500">/compact</code> para alternar modo compacto
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {compact && totalTokens > 0 && (
        <div className="flex items-center justify-end gap-2 mb-2">
          {rtkOn && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600/60" title={`${rtkSaved} tokens economizados`}>
              <Cpu className="w-3 h-3" /> RTK
              {rtkSaved > 0 && <span className="text-emerald-500/80">-{rtkSaved}</span>}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Baseline className="w-3 h-3" />
            {totalTokens.toLocaleString()} tokens
          </span>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} compact={compact} />
      ))}

      {isAgentRunning && agentEvents.map((event, i) => (
        <div key={i} className={cn('flex justify-start', compact ? 'mb-0.5' : 'mb-2')}>
          <div className={cn('bg-zinc-900/50 border border-zinc-800 rounded-lg text-zinc-400', compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs')}>
            {event.type === 'thinking' && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Pensando...</span>
              </div>
            )}
            {event.type === 'tool_call' && (
              <span>🔧 Usando ferramenta: <code className="text-emerald-400">{event.tool}</code></span>
            )}
            {event.type === 'tool_result' && (
              <span>✅ Resultado obtido</span>
            )}
          </div>
        </div>
      ))}

      {isStreaming && streamingContent && (
        <div className={cn('flex justify-start', compact ? 'mb-1' : 'mb-4')}>
          <div className={cn(
            'bg-zinc-800/50 text-zinc-100 border border-zinc-800',
            compact ? 'rounded-lg px-3 py-1.5 max-w-[90%]' : 'rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%]'
          )}>
            <div className={cn('prose max-w-none', compact ? 'prose-xs' : 'prose-invert prose-sm')}>
              <p className="whitespace-pre-wrap">{streamingContent}</p>
            </div>
          </div>
        </div>
      )}

      {isStreaming && !streamingContent && (
        <div className={cn('flex justify-start', compact ? 'mb-1' : 'mb-4')}>
          <div className={cn(
            'bg-zinc-800/50 border border-zinc-800',
            compact ? 'rounded-lg px-2 py-1.5' : 'rounded-2xl rounded-bl-md px-4 py-3'
          )}>
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 className={cn('animate-spin', compact ? 'w-3 h-3' : 'w-4 h-4')} />
              <span className={compact ? 'text-[10px]' : 'text-sm'}>Aguardando resposta...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
