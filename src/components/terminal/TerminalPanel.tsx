import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Plus, X, Trash2 } from 'lucide-react'
import { onTerminalOutput, runCommand, killProcess } from '@/lib/tauri'
import type { TerminalSession, TerminalEvent } from '@/types'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const MOCK_RESPONSES: Record<string, (args: string, cwd: string) => string> = {
  help: () => 'Disponíveis: help, dir, ls, pwd, cd, echo, git, npm, node, clear, cls, whoami, date, Get-ChildItem, Set-Location, Get-Location',
  dir: (_, cwd) => `    Directory: ${cwd}\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n-a----        06/09/2026     10:00           1234 index.ts\n-a----        06/09/2026     09:30            567 package.json\nd-----        06/09/2026     08:00                src\nd-----        06/09/2026     08:00                dist`,
  ls: (_, cwd) => `index.ts  package.json  src/  dist/  node_modules/`,
  pwd: (_, cwd) => cwd,
  whoami: () => 'fluxcodex',
  date: () => new Date().toString(),
  clear: () => '',
  cls: () => '',
}

function mockExecute(command: string, cwd: string): string {
  const trimmed = command.trim()
  const parts = trimmed.split(/\s+/)
  const cmd = parts[0]?.toLowerCase() || ''
  const args = parts.slice(1).join(' ')

  if (cmd === 'cd' || cmd === 'Set-Location') {
    return `Diretório alterado para ${cwd}`
  }

  const mockFn = MOCK_RESPONSES[cmd]
  if (mockFn) return mockFn(args, cwd)

  if (cmd === 'git') {
    if (args.startsWith('status')) return 'On branch main\nYour branch is up to date with \'origin/main\'.'
    if (args.startsWith('log')) return 'commit abc123def456 (HEAD -> main)\nAuthor: User\nDate:   Mon Jun 9 10:00:00 2026\n\n    Initial commit'
    return `git ${args}: simulated (Tauri mode executa real)`
  }
  if (cmd === 'npm') {
    if (args === 'run dev') return '> dev\n> vite\n\n  VITE v5.4.21  ready in 312ms\n  -> http://localhost:1420'
    if (args === 'run build') return '> build\n> tsc && vite build\n\n✓ built in 3.84s'
    return `npm ${args}: simulated`
  }
  if (cmd === 'node') {
    return `node ${args}: simulated`
  }

  return `'${cmd}' não é reconhecido como um comando interno\nou operável (simulação - conecte ao Tauri para execução real)`
}

interface TerminalPanelProps {
  onClose?: () => void
}

export function TerminalPanel({ onClose }: TerminalPanelProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: '1', title: 'powershell', cwd: '.' },
  ])
  const [activeSession, setActiveSession] = useState('1')
  const [output, setOutput] = useState<Record<string, string[]>>({ '1': ['Bem-vindo ao AI App Builder Terminal', 'Use Tauri para execução real de comandos PowerShell'] })
  const [input, setInput] = useState('')
  const [height, setHeight] = useState(200)
  const [cwd, setCwd] = useState<Record<string, string>>({ '1': '.' })
  const terminalRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)
  const cleanupsRef = useRef<Set<() => void>>(new Set())
  const appendOutputRef = useRef<(sessionId: string, lines: string[]) => void>(() => {})

  const appendOutput = useCallback((sessionId: string, lines: string[]) => {
    setOutput(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), ...lines],
    }))
  }, [])

  appendOutputRef.current = appendOutput

  useEffect(() => {
    if (!isTauri()) return

    cleanupsRef.current.forEach(fn => fn())
    cleanupsRef.current.clear()

    sessions.forEach(session => {
      onTerminalOutput(session.id, (event: TerminalEvent) => {
        appendOutputRef.current(session.id, [`[${event.stream}] ${event.output}`])
      }).then(fn => {
        cleanupsRef.current.add(fn)
      })
    })

    return () => {
      cleanupsRef.current.forEach(fn => fn())
      cleanupsRef.current.clear()
    }
  }, [sessions])

  const addSession = () => {
    const id = crypto.randomUUID()
    setSessions(prev => [...prev, { id, title: `pwsh ${prev.length + 1}`, cwd: '.' }])
    setOutput(prev => ({ ...prev, [id]: [] }))
    setCwd(prev => ({ ...prev, [id]: '.' }))
    setActiveSession(id)
  }

  const closeSession = (id: string) => {
    setSessions(prev => {
      if (prev.length === 1) return prev
      const filtered = prev.filter(s => s.id !== id)
      if (activeSession === id) {
        setActiveSession(filtered[0].id)
      }
      return filtered
    })
  }

  const clearSession = () => {
    setOutput(prev => ({ ...prev, [activeSession]: [] }))
  }

  const handleCommand = async () => {
    if (!input.trim()) return
    const cmdLine = input.trim()
    const currentCwd = cwd[activeSession] || '.'
    setInput('')

    appendOutput(activeSession, [`PS ${currentCwd}> ${cmdLine}`])

    if (isTauri()) {
      try {
        await runCommand(cmdLine, currentCwd, activeSession)
      } catch (err) {
        appendOutput(activeSession, [`[Erro] ${err}`])
      }
    } else {
      if (cmdLine.toLowerCase() === 'cls' || cmdLine.toLowerCase() === 'clear') {
        clearSession()
        return
      }

      if (cmdLine.toLowerCase().startsWith('cd ') || cmdLine.toLowerCase().startsWith('Set-Location ')) {
        const dir = cmdLine.split(/\s+/).slice(1).join(' ') || '~'
        const newCwd = dir === '..' ? (currentCwd.split('/').slice(0, -1).join('/') || '.') : dir
        setCwd(prev => ({ ...prev, [activeSession]: newCwd }))
        appendOutput(activeSession, [mockExecute(cmdLine, newCwd)])
        return
      }

      const result = mockExecute(cmdLine, currentCwd)
      if (result) {
        appendOutput(activeSession, result.split('\n'))
      }
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newHeight = window.innerHeight - e.clientY
      if (newHeight > 80 && newHeight < 600) {
        setHeight(newHeight)
      }
    }
    const handleMouseUp = () => { isResizing.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div
      style={{ height }}
      className="bg-zinc-950 border-t border-zinc-800 flex flex-col"
    >
      <div
        className="h-1 bg-zinc-800 hover:bg-zinc-700 cursor-ns-resize shrink-0"
        onMouseDown={() => { isResizing.current = true }}
      />

      <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs cursor-pointer transition-colors',
                activeSession === session.id
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
              onClick={() => setActiveSession(session.id)}
            >
              <span>⚡ {session.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeSession(session.id) }}
                className="p-0.5 rounded hover:bg-zinc-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addSession}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearSession}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            title="Limpar terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
              title="Fechar terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-black"
      >
        {(output[activeSession] || []).map((line, i) => (
          <div key={i} className={cn(
            line.startsWith('PS') && line.includes('>') ? 'text-gold-400' : '',
            line.startsWith('[stdout]') ? 'text-zinc-300' : '',
            line.startsWith('[stderr]') ? 'text-brand-400' : '',
            line.startsWith('[exit]') ? 'text-zinc-600' : '',
            line.startsWith('[Erro]') ? 'text-brand-400' : '',
            !line.startsWith('PS') && !line.startsWith('[') ? 'text-zinc-400' : '',
          )}>
            {line}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800 bg-black">
        <span className="text-gold-400 text-xs font-mono shrink-0">PS {(cwd[activeSession] || '.')}&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
          className="flex-1 bg-transparent text-zinc-100 text-xs font-mono outline-none placeholder-zinc-600"
          placeholder="Digite um comando..."
        />
      </div>
    </div>
  )
}
