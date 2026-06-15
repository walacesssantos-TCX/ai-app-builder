import { useState, useRef, useEffect } from 'react'
import { Plus, Upload, Puzzle, FileText, X } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { SkillsPopup } from './SkillsPopup'
import type { FileAttachment } from '@/types'

const TEXT_EXTENSIONS = new Set(['txt', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'cs', 'sql', 'html', 'css', 'md', 'csv', 'xml', 'yaml', 'yml', 'sh', 'ps1', 'bat', 'env', 'ini', 'cfg', 'log', 'toml', 'lock'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'])
const DOC_EXTENSIONS = new Set(['pdf', 'docx', 'doc', 'xlsx', 'pptx'])

const ALLOWED_EXTENSIONS = [...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS, ...DOC_EXTENSIONS].join(',')

function getFileIcon(mimeType: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTENSIONS.has(ext)) return '🖼️'
  if (AUDIO_EXTENSIONS.has(ext)) return '🎵'
  if (VIDEO_EXTENSIONS.has(ext)) return '🎬'
  if (ext === 'pdf') return '📄'
  if (ext === 'docx' || ext === 'doc') return '📝'
  if (TEXT_EXTENSIONS.has(ext)) return '📃'
  return '📎'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

interface PlusMenuProps {
  conversationId: string | null
  onNavigate?: (tab: string) => void
  onFileSelect?: (file: FileAttachment) => void
}

export function PlusMenu({ conversationId, onNavigate, onFileSelect }: PlusMenuProps) {
  const [open, setOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [contextText, setContextText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const contextRef = useRef<HTMLTextAreaElement>(null)
  const { pendingFiles, removePendingFile } = useChatStore()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setContextOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (contextOpen && contextRef.current) {
      contextRef.current.focus()
    }
  }, [contextOpen])

  const handleFileUpload = () => {
    fileInputRef.current?.click()
    setOpen(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const content = await readFileAsBase64(file)
      onFileSelect?.({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        content,
      })
    } catch {
      // ignore read errors
    }
    if (e.target) e.target.value = ''
  }

  const handleAddContext = () => {
    if (!contextText.trim()) return
    const convId = conversationId || crypto.randomUUID()
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'system',
      content: `[Contexto]\n${contextText.trim()}`,
      createdAt: new Date().toISOString(),
    })
    setContextText('')
    setContextOpen(false)
    setOpen(false)
  }

  const handleSkills = () => {
    setOpen(false)
    setSkillsOpen(true)
  }

  return (
    <div ref={ref} className="relative">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileChange}
      />

      {pendingFiles.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-1.5 max-w-[300px]">
          {pendingFiles.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs"
            >
              <span className="text-[11px]">{getFileIcon(f.mimeType, f.name)}</span>
              <span className="text-zinc-300 truncate max-w-[100px]">{f.name}</span>
              <span className="text-zinc-500 shrink-0">{formatSize(f.size)}</span>
              <button
                onClick={() => removePendingFile(f.name)}
                className="text-zinc-500 hover:text-zinc-300 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <Plus className="w-5 h-5" />
      </button>

      {open && !contextOpen && (
        <div className="absolute bottom-12 left-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 space-y-0.5 z-50">
          <button
            onClick={handleFileUpload}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            onClick={handleSkills}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Puzzle className="w-4 h-4" />
            Skills
          </button>
          <button
            onClick={() => setContextOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Contexto
          </button>
        </div>
      )}

      {contextOpen && (
        <div className="absolute bottom-12 left-0 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 space-y-2 z-50">
          <p className="text-xs font-medium text-zinc-400">Adicionar Contexto</p>
          <textarea
            ref={contextRef}
            value={contextText}
            onChange={e => setContextText(e.target.value)}
            placeholder="Cole instruções, contexto ou informações relevantes..."
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 placeholder-zinc-500 resize-none outline-none focus:border-zinc-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddContext}
              disabled={!contextText.trim()}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            >
              Adicionar
            </button>
            <button
              onClick={() => { setContextOpen(false); setContextText('') }}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <SkillsPopup open={skillsOpen} onClose={() => setSkillsOpen(false)} />
    </div>
  )
}
