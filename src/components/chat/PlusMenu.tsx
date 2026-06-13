import { useState, useRef, useEffect } from 'react'
import { Plus, Upload, Puzzle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat.store'

interface PlusMenuProps {
  conversationId: string | null
  onNavigate?: (tab: string) => void
}

export function PlusMenu({ conversationId, onNavigate }: PlusMenuProps) {
  const [open, setOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [contextText, setContextText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const contextRef = useRef<HTMLTextAreaElement>(null)
  const { addMessage } = useChatStore()

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
    const text = await file.text()
    const convId = conversationId || crypto.randomUUID()
    addMessage({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'system',
      content: `[Upload: ${file.name}]\n\`\`\`\n${text.slice(0, 5000)}\n\`\`\``,
      createdAt: new Date().toISOString(),
    })
    if (e.target) e.target.value = ''
  }

  const handleAddContext = () => {
    if (!contextText.trim()) return
    const convId = conversationId || crypto.randomUUID()
    addMessage({
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
    onNavigate?.('skills')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

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
    </div>
  )
}
