import { useState, useRef, useEffect, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { cn } from '@/lib/utils'
import { Plus, X, Trash2 } from 'lucide-react'
import { createTerminal, writeTerminal, killTerminal, onTerminalOutput, getFluxcodexPaths, readSkill } from '@/lib/tauri'
import { useSkillsStore } from '@/stores/skills.store'
import type { TerminalEvent, FluxcodexPaths } from '@/types'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function isWindows(): boolean {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent.includes('Windows')
  }
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform === 'win32'
  }
  return false
}

function getDefaultCwd(): string {
  return isWindows() ? 'C:\\' : '/home/developer'
}

function getPathSep(): string {
  return isWindows() ? '\\' : '/'
}

interface TerminalPanelProps {
  onClose?: () => void
}

interface SessionInfo {
  id: string
  title: string
}

const THEME = {
  background: '#000000',
  foreground: '#d4d4d4',
  cursor: '#ffd700',
  cursorAccent: '#000000',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#f14c4c',
  green: '#6bb05d',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#d4d4d4',
  brightBlack: '#555555',
  brightRed: '#f14c4c',
  brightGreen: '#6bb05d',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
}

function normalizeCwd(cwd: string, command: string): string {
  const trimmed = command.trim()
  if (!trimmed.startsWith('cd ')) return cwd

  const dir = trimmed.slice(3).trim()
  if (!dir) return cwd
  const sep = getPathSep()

  if (dir === '..') {
    const parts = cwd.replace(/\/$/, '').split(/[\\/]/)
    if (parts.length > 1) {
      parts.pop()
      return parts.join(sep)
    }
    return isWindows() ? cwd[0] + ':\\' : '/'
  }

  if (dir === '\\' || dir === '/') {
    return isWindows() ? cwd[0] + ':\\' : '/'
  }

  if (/^[a-zA-Z]:/.test(dir)) {
    return dir.replace(/\//g, '\\')
  }

  if (dir.startsWith('/')) {
    return dir
  }

  const glue = cwd.endsWith(sep) ? '' : sep
  return cwd + glue + dir
}

export function TerminalPanel({ onClose }: TerminalPanelProps) {
  const defaultShell = isWindows() ? 'cmd' : 'bash'
  const [sessions, setSessions] = useState<SessionInfo[]>([
    { id: '1', title: defaultShell },
  ])
  const [activeSession, setActiveSession] = useState('1')
  const [height, setHeight] = useState(250)

  const terminalsRef = useRef<Map<string, Terminal>>(new Map())
  const fitAddonsRef = useRef<Map<string, FitAddon>>(new Map())
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const unlistenersRef = useRef<Map<string, () => void>>(new Map())
  const cwdRef = useRef<Map<string, string>>(new Map())
  const lineBufRef = useRef<Map<string, string>>(new Map())
  const cmdHistoryRef = useRef<Map<string, string[]>>(new Map())
  const histIdxRef = useRef<Map<string, number>>(new Map())
  const initDoneRef = useRef<Set<string>>(new Set())
  const isResizing = useRef(false)
  const nextId = useRef(2)

  const setupSession = useCallback(async (sessionId: string) => {
    if (initDoneRef.current.has(sessionId)) return
    initDoneRef.current.add(sessionId)

    if (!isTauri()) {
      const term = terminalsRef.current.get(sessionId)
      if (term) {
        showSkillsBanner(term, '', 'http://localhost:3001/mcp-skills')
      }
      setupMockTerminal(sessionId)
      return
    }

    try {
      const cwd = cwdRef.current.get(sessionId) || getDefaultCwd()
      await createTerminal(sessionId, cwd)

      setupTauriTerminal(sessionId)
    } catch (err) {
      const term = terminalsRef.current.get(sessionId)
      term?.writeln(`\r\n[Erro ao iniciar terminal: ${err}]`)
    }
  }, [])

  const showSkillsBanner = (term: Terminal, skillsDir: string, mcpUrl: string) => {
    const hasSkills = skillsDir && skillsDir.length > 0
    term.writeln('\x1b[33m\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')
    term.writeln('\x1b[33m  \u26A1 Fluxcodex Terminal')
    term.writeln('\x1b[33m  Skills do ecossistema dispon\u00edveis via:')
    if (hasSkills) {
      term.writeln(`\x1b[33m    \u2022 AI_BUILDER_SKILLS_DIR`)
      term.writeln(`\x1b[33m    \u2022 AI_BUILDER_PROJECT_ROOT`)
    }
    term.writeln(`\x1b[33m    \u2022 MCP Skills: \x1b[36m${mcpUrl}\x1b[33m`)
    if (hasSkills) {
      term.writeln(`\x1b[90m    Skills: ${skillsDir}`)
    }
    term.writeln('\x1b[33m  Use \x1b[36mskills --list\x1b[33m para listar skills')
    term.writeln('\x1b[33m  Use \x1b[36mskills --read <nome>\x1b[33m para ler uma skill')
    term.writeln('\x1b[33m\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\x1b[0m')
  }

  const setupMockTerminal = (sessionId: string) => {
    const term = terminalsRef.current.get(sessionId)
    if (!term) return

    term.writeln('Modo simulação (sem Tauri)')
    term.writeln('Digite comandos para simular')
    prompt(term, sessionId)

    setupInputHandler(term, sessionId, true)
  }

  const setupTauriTerminal = async (sessionId: string) => {
    const term = terminalsRef.current.get(sessionId)
    if (!term) return

    try {
      const paths = await getFluxcodexPaths()
      const skillsDir = paths.skills_dir
      const mcpUrl = `http://127.0.0.1:3001/mcp-skills`
      showSkillsBanner(term, skillsDir, mcpUrl)
    } catch {
      showSkillsBanner(term, '', '')
    }

    if (isWindows()) {
      term.writeln('Microsoft Windows [Version 10.0.22621.xxxx]')
      term.writeln('(c) Microsoft Corporation. Todos os direitos reservados.')
    } else {
      term.writeln(`Linux ${navigator?.platform || ''} - Terminal Fluxcodex`)
    }
    prompt(term, sessionId)

    setupInputHandler(term, sessionId, false)

    const unlisten = onTerminalOutput(sessionId, (event: TerminalEvent) => {
      const t = terminalsRef.current.get(sessionId)
      if (!t) return
      if (event.stream === 'exit') return
      t.write(event.output)
    })

    unlisten.then((fn: () => void) => {
      unlistenersRef.current.set(sessionId, fn)
    })
  }

  const setupInputHandler = (term: Terminal, sessionId: string, isMock: boolean) => {
    term.onData((data: string) => {
      const code = data.charCodeAt(0)
      const buf = lineBufRef.current
      const cwd = cwdRef.current
      const history = cmdHistoryRef.current
      const histIdx = histIdxRef.current
      let line = buf.get(sessionId) || ''

      if (code === 13) {
        term.write('\r\n')
        if (line.trim()) {
          const cmdLine = line
          line = ''
          buf.set(sessionId, '')

          const hist = history.get(sessionId) || []
          hist.push(cmdLine)
          history.set(sessionId, hist)
          histIdx.set(sessionId, hist.length)

          if (cmdLine.toLowerCase().startsWith('cd ')) {
            const curCwd = cwd.get(sessionId) || getDefaultCwd()
            const newCwd = normalizeCwd(curCwd, cmdLine)
            cwd.set(sessionId, newCwd)
          }

          if (cmdLine.toLowerCase().trim().startsWith('skills ')) {
            handleSkillsCommand(term, sessionId, cmdLine.trim())
          } else if (isMock) {
            handleMockCommand(term, sessionId, cmdLine)
          } else {
            executeCommand(sessionId, cmdLine)
          }
        } else {
          prompt(term, sessionId)
        }
      } else if (code === 127) {
        if (line.length > 0) {
          line = line.slice(0, -1)
          buf.set(sessionId, line)
          term.write('\b \b')
        }
      } else if (code === 3) {
        term.write('^C\r\n')
        line = ''
        buf.set(sessionId, '')
        prompt(term, sessionId)
      } else if (code === 9) {
      } else if (code === 27) {
        const rest = data.slice(1)
        if (rest === '[A') {
          const h = history.get(sessionId) || []
          let idx = histIdx.get(sessionId) ?? h.length
          if (idx > 0) {
            idx--
            histIdx.set(sessionId, idx)
            const prev = h[idx]
            while (line.length > 0) {
              line = line.slice(0, -1)
              term.write('\b \b')
            }
            line = prev
            buf.set(sessionId, line)
            term.write(line)
          }
        } else if (rest === '[B') {
          const h = history.get(sessionId) || []
          let idx = histIdx.get(sessionId) ?? h.length
          if (idx < h.length) {
            idx++
            histIdx.set(sessionId, idx)
            while (line.length > 0) {
              line = line.slice(0, -1)
              term.write('\b \b')
            }
            if (idx < h.length) {
              line = h[idx]
              buf.set(sessionId, line)
              term.write(line)
            } else {
              line = ''
              buf.set(sessionId, '')
            }
          }
        }
      } else if (code < 32) {
      } else {
        line += data
        buf.set(sessionId, line)
        term.write(data)
      }
    })
  }

  const handleSkillsCommand = async (term: Terminal, _sessionId: string, cmd: string) => {
    const parts = cmd.split(/\s+/)
    const sub = parts[1]

    if (!sub) {
      term.writeln('\x1b[33mComandos skills:\x1b[0m')
      term.writeln('  \x1b[36mskills --list\x1b[0m        Listar todas skills disponíveis')
      term.writeln('  \x1b[36mskills --read <nome>\x1b[0m  Ler conteúdo de uma skill')
      term.writeln('')
      const count = useSkillsStore.getState().available.length
      term.writeln(`\x1b[90m  ${count} skills carregadas\x1b[0m`)
      prompt(term, _sessionId)
      return
    }

    if (sub === '--list') {
      term.writeln('\x1b[33mSkills disponíveis:\x1b[0m')
      const skills = useSkillsStore.getState().available
      for (const s of skills) {
        const pin = useSkillsStore.getState().pinned.includes(s.name) ? ' \x1b[33m\u2605\x1b[0m' : ''
        const cat = s.category || 'geral'
        term.writeln(`  \x1b[36m${s.name}\x1b[0m ${pin}`)
        term.writeln(`      ${s.description}`)
        term.writeln(`      \x1b[90m[${cat}] prioridade: ${s.priority}\x1b[0m`)
      }
      term.writeln(`\x1b[90mTotal: ${skills.length} skills\x1b[0m`)
      prompt(term, _sessionId)
      return
    }

    if (sub === '--read') {
      const name = parts.slice(2).join(' ')
      if (!name) {
        term.writeln('\x1b[31mUso: skills --read <nome-da-skill>\x1b[0m')
        prompt(term, _sessionId)
        return
      }
      const skills = useSkillsStore.getState().available
      const skill = skills.find(s => s.name.toLowerCase() === name.toLowerCase())
      if (!skill) {
        term.writeln(`\x1b[31mSkill '${name}' não encontrada\x1b[0m`)
        term.writeln('\x1b[33mUse skills --list para ver todas disponíveis\x1b[0m')
        prompt(term, _sessionId)
        return
      }

      term.writeln(`\x1b[33m=== ${skill.name} ===\x1b[0m`)
      if (skill.description) term.writeln(`  \x1b[90m${skill.description}\x1b[0m`)
      if (skill.tags?.length) term.writeln(`  \x1b[90mtags: ${skill.tags.join(', ')}\x1b[0m`)
      term.writeln(`  \x1b[90mprioridade: ${skill.priority}\x1b[0m`)

      if (skill.path && skill.path !== `builtin://${skill.name}` && isTauri()) {
        try {
          const full = await readSkill(skill.path)
          const lines = full.content.split('\n').slice(0, 30)
          term.writeln('')
          term.writeln('\x1b[36m--- conteúdo (primeiras 30 linhas) ---\x1b[0m')
          for (const line of lines) term.writeln(`  ${line}`)
          if (full.content.split('\n').length > 30) term.writeln('  \x1b[90m... (truncado)\x1b[0m')
        } catch {
          term.writeln('\x1b[31m[Erro ao ler conteúdo completo]\x1b[0m')
        }
      } else if (skill.content) {
        const lines = skill.content.split('\n').slice(0, 15)
        term.writeln('')
        term.writeln('\x1b[36m--- conteúdo ---\x1b[0m')
        for (const line of lines) term.writeln(`  ${line}`)
      } else {
        term.writeln('\x1b[90m  (conteúdo embutido — veja no editor de skills)\x1b[0m')
      }
      prompt(term, _sessionId)
      return
    }

    term.writeln(`\x1b[31mSubcomando desconhecido: '${sub}'\x1b[0m`)
    term.writeln('\x1b[33mUse \x1b[36mskills\x1b[33m (sem argumentos) para ajuda\x1b[0m')
    prompt(term, _sessionId)
  }

  const executeCommand = async (sessionId: string, command: string) => {
    try {
      await writeTerminal(sessionId, command)
    } catch (err) {
      const term = terminalsRef.current.get(sessionId)
      term?.writeln(`[Erro] ${err}`)
    }
  }

  const handleMockCommand = (term: Terminal, sessionId: string, command: string) => {
    const cwd = cwdRef.current.get(sessionId) || getDefaultCwd()
    const lower = command.trim().toLowerCase()

    if (lower === 'cls' || lower === 'clear') {
      term.clear()
      prompt(term, sessionId)
      return
    }

    if (lower === 'help') {
      term.writeln('Comandos disponíveis: help, dir, ls, pwd, cd, echo, cls, clear, whoami, date, git, npm')
      prompt(term, sessionId)
      return
    }

    if (lower === 'dir' || lower === 'ls') {
      if (isWindows()) {
        term.writeln(` Directory of ${cwd}`)
        term.writeln('')
        term.writeln('06/16/2026  10:00 AM    <DIR>          .')
        term.writeln('06/16/2026  10:00 AM    <DIR>          ..')
        term.writeln('06/16/2026  10:00 AM             1,234 index.ts')
        term.writeln('06/16/2026  09:30 AM               567 package.json')
        term.writeln('06/16/2026  08:00 AM    <DIR>          src')
        term.writeln('               2 File(s)          1,801 bytes')
        term.writeln('               3 Dir(s)  100,000,000,000 bytes free')
      } else {
        term.writeln(`total 12`)
        term.writeln('drwxr-xr-x  3 developer developer  128 Jun 16 10:00 .')
        term.writeln('drwxr-xr-x  3 developer developer  128 Jun 16 10:00 ..')
        term.writeln('-rw-r--r--  1 developer developer 1234 Jun 16 10:00 index.ts')
        term.writeln('-rw-r--r--  1 developer developer  567 Jun 16 09:30 package.json')
        term.writeln('drwxr-xr-x  2 developer developer   96 Jun 16 08:00 src')
      }
      prompt(term, sessionId)
      return
    }

    if (lower === 'pwd') {
      term.writeln(cwd)
      prompt(term, sessionId)
      return
    }

    if (lower.startsWith('echo ')) {
      term.writeln(command.slice(5))
      prompt(term, sessionId)
      return
    }

    if (lower === 'whoami') {
      term.writeln('fluxcodex')
      prompt(term, sessionId)
      return
    }

    if (lower === 'date') {
      term.writeln(new Date().toString())
      prompt(term, sessionId)
      return
    }

    if (lower.startsWith('git ')) {
      const args = lower.slice(4)
      if (args.startsWith('status')) term.writeln('On branch main\nYour branch is up to date.')
      else if (args.startsWith('log')) term.writeln('commit abc123def456 (HEAD -> main)\nAuthor: User\nDate:   Mon Jun 16 10:00:00 2026\n\n    Initial commit')
      else term.writeln(`git ${args}: simulado (conecte ao Tauri para real)`)
      prompt(term, sessionId)
      return
    }

    if (lower.startsWith('npm ')) {
      const args = lower.slice(4)
      if (args === 'run dev') term.writeln('\n> dev\n> vite\n\n  VITE v5.4.21  ready in 312ms\n  -> http://localhost:1420')
      else if (args === 'run build') term.writeln('\n> build\n> tsc && vite build\n\n\u2713 built in 3.84s')
      else term.writeln(`npm ${args}: simulado`)
      prompt(term, sessionId)
      return
    }

    const cmd = command.split(' ')[0]
    const msg = isWindows()
      ? `'${cmd}' não é reconhecido como comando interno (simulação)`
      : `bash: ${cmd}: command not found (simulação)`
    term.writeln(msg)
    prompt(term, sessionId)
  }

  const prompt = (term: Terminal, sessionId: string) => {
    const cwd = cwdRef.current.get(sessionId) || getDefaultCwd()
    const ps = isWindows() ? '>' : '$'
    term.write(`\r\n${cwd} ${ps} `)
  }

  const initTerminal = useCallback((sessionId: string) => {
    const container = containersRef.current.get(sessionId)
    if (!container || terminalsRef.current.has(sessionId)) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace',
      theme: THEME,
      allowTransparency: false,
      scrollback: 10000,
      disableStdin: false,
      cols: 80,
      rows: 10,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    terminalsRef.current.set(sessionId, term)
    fitAddonsRef.current.set(sessionId, fitAddon)
    lineBufRef.current.set(sessionId, '')
    cwdRef.current.set(sessionId, getDefaultCwd())
    cmdHistoryRef.current.set(sessionId, [])
    histIdxRef.current.set(sessionId, 0)

    setTimeout(() => {
      try { fitAddon.fit() } catch {}
      setupSession(sessionId)
    }, 50)
  }, [setupSession])

  const addSession = () => {
    const id = String(nextId.current++)
    setSessions(prev => [...prev, { id, title: `${defaultShell} ${id}` }])
    setActiveSession(id)
    cwdRef.current.set(id, getDefaultCwd())
    lineBufRef.current.set(id, '')
    cmdHistoryRef.current.set(id, [])
    histIdxRef.current.set(id, 0)
    setTimeout(() => {
      initTerminal(id)
      const fitAddon = fitAddonsRef.current.get(id)
      if (fitAddon) {
        setTimeout(() => fitAddon.fit(), 100)
      }
    }, 50)
  }

  const closeSession = (id: string) => {
    if (sessions.length <= 1) return

    const idx = sessions.findIndex(s => s.id === id)
    const term = terminalsRef.current.get(id)
    if (term) {
      term.dispose()
      terminalsRef.current.delete(id)
    }
    fitAddonsRef.current.delete(id)
    containersRef.current.delete(id)

    const fn = unlistenersRef.current.get(id)
    if (fn) { fn(); unlistenersRef.current.delete(id) }

    initDoneRef.current.delete(id)

    if (isTauri()) killTerminal(id).catch(() => {})

    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSession === id) {
      const newIdx = Math.min(idx, sessions.length - 2)
      setActiveSession(sessions.filter(s => s.id !== id)[newIdx].id)
    }
  }

  const clearSession = () => {
    const term = terminalsRef.current.get(activeSession)
    if (term) {
      term.clear()
      prompt(term, activeSession)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newHeight = window.innerHeight - e.clientY
      if (newHeight > 80 && newHeight < 800) {
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

  useEffect(() => {
    if (!activeSession) return
    const term = terminalsRef.current.get(activeSession)
    if (term) {
      setTimeout(() => {
        const fitAddon = fitAddonsRef.current.get(activeSession)
        if (fitAddon) fitAddon.fit()
        term.focus()
      }, 50)
    }
  }, [activeSession])

  useEffect(() => {
    const handleResize = () => {
      fitAddonsRef.current.forEach(fa => {
        try { fa.fit() } catch {}
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setTimeout(() => {
      sessions.forEach(s => initTerminal(s.id))
    }, 100)

    return () => {
      terminalsRef.current.forEach(term => term.dispose())
      terminalsRef.current.clear()
      fitAddonsRef.current.clear()
      unlistenersRef.current.forEach(fn => fn())
      unlistenersRef.current.clear()
      if (isTauri()) {
        sessions.forEach(s => killTerminal(s.id).catch(() => {}))
      }
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

      <div className="flex items-center justify-between px-3 py-0 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-0">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer transition-colors select-none',
                activeSession === session.id
                  ? 'bg-black text-zinc-100 border-t border-gold-500'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              )}
              onClick={() => {
                setActiveSession(session.id)
                const term = terminalsRef.current.get(session.id)
                if (term) {
                  setTimeout(() => {
                    const fa = fitAddonsRef.current.get(session.id)
                    if (fa) fa.fit()
                    term.focus()
                  }, 50)
                }
              }}
            >
              <span className="text-gold-400">&#x26A1;</span>
              <span>{session.title}</span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeSession(session.id) }}
                  className="p-0.5 rounded hover:bg-zinc-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addSession}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 ml-1"
            title="Nova sessão"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
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

      <div className="flex-1 relative bg-black overflow-hidden">
        {sessions.map((session) => (
          <div
            key={session.id}
            ref={(el) => {
              if (el) containersRef.current.set(session.id, el)
              else containersRef.current.delete(session.id)
            }}
            className="absolute inset-0"
            style={{ display: session.id === activeSession ? 'block' : 'none' }}
          />
        ))}
      </div>
    </div>
  )
}
