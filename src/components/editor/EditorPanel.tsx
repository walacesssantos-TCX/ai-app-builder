import { useProjectStore } from '@/stores/project.store'
import { CodeEditor } from './CodeEditor'
import { X, Circle, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EditorPanel() {
  const { openFiles, activeFileId, setActiveFile, closeFile } = useProjectStore()

  if (openFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <FileCode className="w-12 h-12 text-zinc-800 mx-auto" />
          <p className="text-sm text-zinc-600">Nenhum arquivo aberto</p>
          <p className="text-xs text-zinc-700 max-w-xs">
            Clique em um arquivo no explorador para abri-lo no editor
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 overflow-x-auto shrink-0">
        {openFiles.map((file) => (
          <div
            key={file.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-zinc-800 select-none shrink-0',
              'transition-colors group',
              activeFileId === file.id
                ? 'bg-zinc-950 text-zinc-100 border-t-2 border-t-blue-500'
                : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            )}
            onClick={() => setActiveFile(file.id)}
          >
            {file.isDirty && (
              <Circle className="w-2 h-2 fill-blue-400 text-gold-400 shrink-0" />
            )}
            <span className="truncate max-w-32">{file.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeFile(file.id) }}
              className="p-0.5 rounded hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <CodeEditor />
      </div>
    </div>
  )
}
