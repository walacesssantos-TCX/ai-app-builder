import { useState, useRef, useEffect } from 'react'
import { Send, Square } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useStream } from '@/hooks/useStream'
import { PlusMenu } from './PlusMenu'
import { ModeSelector } from './ModeSelector'

interface ChatInputProps {
  onNavigate?: (tab: string) => void
}

export function ChatInput({ onNavigate }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isStreaming, activeConversationId, mode, compact, newConversation, toggleCompact } = useChatStore()
  const activeModel = useSettingsStore((state) => state.activeModel)
  const { sendMessage, cancel } = useStream()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    const msg = input.trim()

    // Handle /commands
    if (msg === '/compact') {
      toggleCompact()
      setInput('')
      return
    }

    const convId = activeConversationId || crypto.randomUUID()
    if (!activeConversationId) {
      newConversation(convId, activeModel)
    }

    setInput('')

    await sendMessage(msg, mode, convId, '')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 mb-2">
        <ModeSelector />
      </div>
      <div className="flex items-end gap-2 bg-zinc-900 rounded-2xl border border-zinc-800 px-4 py-3 focus-within:border-zinc-600 transition-colors">
        <PlusMenu
          conversationId={activeConversationId}
          onNavigate={onNavigate}
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          rows={1}
          className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none text-sm leading-relaxed max-h-[200px]"
        />
        {isStreaming ? (
          <button
            onClick={cancel}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shrink-0"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
