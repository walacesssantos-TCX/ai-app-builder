import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, SplitSquareHorizontal, Columns, ChevronDown, ChevronRight, FileCode } from 'lucide-react'

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'hunk' | 'header'
  content: string
  oldLine?: number
  newLine?: number
}

interface Hunk {
  header: string
  lines: DiffLine[]
  oldStart: number
  newStart: number
}

interface FileDiff {
  oldPath: string
  newPath: string
  hunks: Hunk[]
}

function parseDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = []
  let currentFile: FileDiff | null = null
  let currentHunk: Hunk | null = null
  let oldLineOffset = 0
  let newLineOffset = 0

  const lines = diffText.split('\n')

  for (const raw of lines) {
    const line = raw

    if (line.startsWith('--- ')) {
      if (currentFile && currentHunk) {
        currentFile.hunks.push(currentHunk)
      }
      if (currentFile) {
        files.push(currentFile)
      }
      currentFile = { oldPath: line.slice(6), newPath: '', hunks: [] }
      currentHunk = null
      continue
    }

    if (line.startsWith('+++ ')) {
      if (currentFile) {
        currentFile.newPath = line.slice(6)
      }
      continue
    }

    if (line.startsWith('@@')) {
      if (currentFile && currentHunk) {
        currentFile.hunks.push(currentHunk)
      }
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (match) {
        oldLineOffset = parseInt(match[1], 10)
        newLineOffset = parseInt(match[3], 10)
        currentHunk = {
          header: line,
          lines: [{ type: 'hunk', content: line }],
          oldStart: oldLineOffset,
          newStart: newLineOffset,
        }
      }
      continue
    }

    if (!currentHunk) {
      if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) {
        continue
      }
      continue
    }

    const firstChar = line.charAt(0)
    let type: DiffLine['type']
    let content: string
    let oldLine: number | undefined
    let newLine: number | undefined

    if (firstChar === ' ') {
      type = 'context'
      content = line.slice(1)
      oldLine = oldLineOffset++
      newLine = newLineOffset++
    } else if (firstChar === '-') {
      type = 'remove'
      content = line.slice(1)
      oldLine = oldLineOffset++
      newLine = undefined
    } else if (firstChar === '+') {
      type = 'add'
      content = line.slice(1)
      oldLine = undefined
      newLine = newLineOffset++
    } else if (firstChar === '\\') {
      type = 'context'
      content = line
    } else {
      type = 'context'
      content = line
      oldLine = oldLineOffset++
      newLine = newLineOffset++
    }

    currentHunk.lines.push({ type, content, oldLine, newLine })
  }

  if (currentFile && currentHunk) {
    currentFile.hunks.push(currentHunk)
  }
  if (currentFile) {
    files.push(currentFile)
  }

  return files
}

interface DiffViewerProps {
  diff: string
  oldName?: string
  newName?: string
  className?: string
}

export function DiffViewer({ diff, oldName, newName, className }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const files = useMemo(() => parseDiff(diff), [diff])

  const totalChanges = useMemo(() => {
    let adds = 0
    let removes = 0
    for (const file of files) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') adds++
          if (line.type === 'remove') removes++
        }
      }
    }
    return { adds, removes }
  }, [files])

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(diff)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleFile = (path: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  if (!diff || files.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center space-y-2">
          <FileCode className="w-10 h-10 text-zinc-800 mx-auto" />
          <p className="text-sm text-zinc-600">Nenhuma diff para mostrar</p>
          <p className="text-xs text-zinc-700">As alterações aparecerão aqui</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('h-full flex flex-col bg-zinc-950', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Diff</span>
          <span className="text-gold-400">+{totalChanges.adds}</span>
          <span className="text-brand-400">-{totalChanges.removes}</span>
          <span className="text-zinc-600">{files.length} arquivo{files.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('unified')}
            className={cn(
              'p-1.5 rounded text-xs transition-colors',
              viewMode === 'unified' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            )}
            title="Visão unificada"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={cn(
              'p-1.5 rounded text-xs transition-colors',
              viewMode === 'split' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            )}
            title="Visão lado a lado"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopyAll}
            className="p-1.5 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Copiar diff completa"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-gold-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs leading-5">
        {files.map((file, fileIdx) => {
          const fileKey = file.newPath || file.oldPath || `file-${fileIdx}`
          const isCollapsed = collapsedFiles.has(fileKey)

          return (
            <div key={fileKey} className="border-b border-zinc-800/50 last:border-b-0">
              <button
                onClick={() => toggleFile(fileKey)}
                className="flex items-center gap-2 w-full px-3 py-1.5 bg-zinc-900/50 hover:bg-zinc-900 text-left text-xs text-zinc-300 border-b border-zinc-800/30"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
                <FileCode className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span className="truncate">{fileKey.replace(/^[ab]\//, '')}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(fileKey) }}
                  className="ml-auto p-0.5 rounded text-zinc-600 hover:text-zinc-400 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </button>

              {!isCollapsed && file.hunks.map((hunk, hunkIdx) => (
                <div key={hunkIdx}>
                  {viewMode === 'unified' ? (
                    <RenderHunkUnified hunk={hunk} />
                  ) : (
                    <RenderHunkSplit hunk={hunk} />
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {files.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-zinc-600">Nenhuma mudança para exibir</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface RenderHunkUnifiedProps {
  hunk: Hunk
}

function RenderHunkUnified({ hunk }: RenderHunkUnifiedProps) {
  return (
    <div>
      <div className="px-3 py-1 bg-zinc-900/30 text-zinc-500 text-[11px] font-mono border-b border-zinc-800/20">
        {hunk.header}
      </div>
      {hunk.lines.map((line, i) => (
        <LineRow key={i} line={line} viewMode="unified" />
      ))}
    </div>
  )
}

interface RenderHunkSplitProps {
  hunk: Hunk
}

function RenderHunkSplit({ hunk }: RenderHunkSplitProps) {
  const splitLines: Array<[DiffLine | null, DiffLine | null]> = []
  const contentLines = hunk.lines.filter(l => l.type !== 'hunk')
  let i = 0

  while (i < contentLines.length) {
    const line = contentLines[i]
    if (line.type === 'context') {
      splitLines.push([line, { ...line, oldLine: undefined, newLine: undefined }])
      i++
    } else if (line.type === 'remove') {
      const next = contentLines[i + 1]
      if (next && next.type === 'add') {
        splitLines.push([line, next])
        i += 2
      } else {
        splitLines.push([line, null])
        i++
      }
    } else if (line.type === 'add') {
      splitLines.push([null, line])
      i++
    } else {
      splitLines.push([line, line])
      i++
    }
  }

  return (
    <div>
      <div className="px-3 py-1 bg-zinc-900/30 text-zinc-500 text-[11px] font-mono border-b border-zinc-800/20">
        {hunk.header}
      </div>
      {splitLines.map(([left, right], i) => (
        <div key={i} className="flex">
          <div className="w-1/2 border-r border-zinc-800/30">
            {left ? (
              <LineRow line={left} viewMode="split" side="left" />
            ) : (
              <div className="flex h-5">
                <span className="w-10 shrink-0 text-right pr-2 text-zinc-700 select-none bg-zinc-950" />
                <span className="flex-1 bg-zinc-950" />
              </div>
            )}
          </div>
          <div className="w-1/2">
            {right ? (
              <LineRow line={right} viewMode="split" side="right" />
            ) : (
              <div className="flex h-5">
                <span className="w-10 shrink-0 text-right pr-2 text-zinc-700 select-none bg-zinc-950" />
                <span className="flex-1 bg-zinc-950" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface LineRowProps {
  line: DiffLine
  viewMode: 'unified' | 'split'
  side?: 'left' | 'right'
}

function LineRow({ line, viewMode, side }: LineRowProps) {
  if (line.type === 'hunk') return null

  const isRemove = line.type === 'remove'
  const isAdd = line.type === 'add'
  const lineNum = isRemove ? line.oldLine : line.newLine
  const bg = isAdd
    ? 'bg-emerald-950/40'
    : isRemove
      ? 'bg-red-950/40'
      : 'bg-transparent'
  const textColor = isAdd
    ? 'text-gold-300'
    : isRemove
      ? 'text-red-300'
      : 'text-zinc-300'

  if (viewMode === 'split' && side === 'left' && line.type === 'add') {
    return (
      <div className="flex h-5">
        <span className="w-10 shrink-0 text-right pr-2 text-zinc-700 select-none bg-zinc-950" />
        <span className="flex-1 bg-zinc-950" />
      </div>
    )
  }

  if (viewMode === 'split' && side === 'right' && line.type === 'remove') {
    return (
      <div className="flex h-5">
        <span className="w-10 shrink-0 text-right pr-2 text-zinc-700 select-none bg-zinc-950" />
        <span className="flex-1 bg-zinc-950" />
      </div>
    )
  }

  return (
    <div className={cn('flex', bg)}>
      <span className={cn(
        'w-10 shrink-0 text-right pr-2 select-none leading-5',
        line.type === 'context' ? 'text-zinc-700' : 'text-zinc-500'
      )}>
        {lineNum ?? ''}
      </span>
      <span className={cn('flex-1 pl-2 whitespace-pre leading-5', textColor)}>
        {viewMode === 'unified' && (isAdd ? '+' : isRemove ? '-' : ' ')}
        {line.content}
      </span>
    </div>
  )
}
