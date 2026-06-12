import { useState, useEffect, useRef } from 'react'
import { ScrollText, Trash2, Download, Loader, AlertCircle, Info, Terminal, Bug } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat.store'

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'system'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  details?: string
}

const levelConfig: Record<LogLevel, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-900/20' },
  warn: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-900/20' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/20' },
  debug: { icon: Bug, color: 'text-purple-400', bg: 'bg-purple-900/20' },
  system: { icon: Terminal, color: 'text-zinc-400', bg: 'bg-zinc-900/50' },
}

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const agentEvents = useChatStore(s => s.agentEvents)
  const isAgentRunning = useChatStore(s => s.isAgentRunning)
  const streamingContent = useChatStore(s => s.streamingContent)

  useEffect(() => {
    if (agentEvents.length === 0) return

    const newEntries: LogEntry[] = agentEvents.map(ev => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: ev.type === 'tool_result' ? 'info' : ev.type === 'tool_call' ? 'debug' : ev.type === 'thinking' ? 'system' : 'info',
      source: ev.type === 'thinking' ? 'Agente' : ev.type === 'tool_call' ? `Tool: ${ev.tool || ''}` : 'Sistema',
      message: ev.content || ev.type,
      details: ev.result || JSON.stringify(ev.params || ''),
    }))

    setLogs(prev => [...prev, ...newEntries].slice(-500))
  }, [agentEvents])

  useEffect(() => {
    if (!autoScroll) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs, autoScroll, streamingContent])

  const handleClear = () => setLogs([])

  const handleDownload = () => {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}${l.details ? `\n  ${l.details}` : ''}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = filterLevel === 'all' ? logs : logs.filter(l => l.level === filterLevel)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">Logs</span>
          {logs.length > 0 && (
            <span className="text-[10px] text-zinc-700 bg-zinc-900 px-1.5 py-0.5 rounded">{logs.length}</span>
          )}
          {isAgentRunning && <Loader className="w-3 h-3 text-emerald-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'error', 'warn', 'info', 'debug', 'system'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] uppercase transition-colors',
                filterLevel === level ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-700 hover:text-zinc-500'
              )}
            >
              {level === 'all' ? 'Todas' : level}
            </button>
          ))}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn('px-1.5 py-0.5 rounded text-[10px] transition-colors', autoScroll ? 'text-emerald-400' : 'text-zinc-700 hover:text-zinc-500')}
          >
            Auto
          </button>
          <button onClick={handleDownload} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300" title="Download">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleClear} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300" title="Limpar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono">
        {filteredLogs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-zinc-700">
              {logs.length === 0 ? 'Nenhum log gerado ainda.' : 'Nenhum log com este nível de filtro.'}
            </p>
          </div>
        )}
        {filteredLogs.map(log => {
          const cfg = levelConfig[log.level]
          return (
            <div key={log.id} className="group flex items-start gap-2 px-2 py-0.5 rounded hover:bg-zinc-900/50">
              <span className="text-[10px] text-zinc-700 shrink-0 w-16">{log.timestamp.slice(11, 19)}</span>
              <cfg.icon className={cn('w-3 h-3 mt-0.5 shrink-0', cfg.color)} />
              <span className={cn('text-[10px] uppercase font-medium shrink-0 w-12', cfg.color)}>{log.level}</span>
              <span className="text-[10px] text-zinc-700 shrink-0 w-20 truncate">{log.source}</span>
              <span className="text-[11px] text-zinc-400 break-all">{log.message}</span>
              {isAgentRunning && (
                <span className="text-[10px] text-zinc-700 ml-auto animate-pulse">●</span>
              )}
            </div>
          )
        })}
        {streamingContent && (
          <div className="flex items-start gap-2 px-2 py-0.5 rounded bg-emerald-900/10">
            <span className="text-[10px] text-zinc-700 shrink-0 w-16">{new Date().toISOString().slice(11, 19)}</span>
            <Info className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
            <span className="text-[10px] uppercase font-medium shrink-0 w-12 text-emerald-400">Stream</span>
            <span className="text-[10px] text-zinc-700 shrink-0 w-20">Sidecar</span>
            <span className="text-[11px] text-zinc-500 truncate">{streamingContent.slice(0, 200)}{streamingContent.length > 200 ? '...' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
