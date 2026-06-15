import { useEffect, useState } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { MessageSquare, Trash2, MessageCircle, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatPanel } from './ChatPanel'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Ontem'
  if (days < 7) return `${days} dias atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function HistoryPanel() {
  const { conversations, activeConversationId, setActiveConversation, loadConversations, deleteConversation } = useChatStore()
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  if (activeConversationId) {
    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-950">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
          <button
            onClick={() => setActiveConversation(null)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-zinc-400">
            {conversations.find(c => c.id === activeConversationId)?.title || 'Conversa'}
          </span>
        </div>
        <ChatPanel />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-zinc-400" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">Histórico</h2>
        </div>
        <span className="text-xs text-zinc-500">{conversations.length} conversas</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">Nenhuma conversa salva</p>
            <p className="text-xs text-zinc-600 mt-1">As conversas aparecerão aqui automaticamente</p>
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-800/50 border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
            onClick={() => setActiveConversation(conv.id)}
          >
            <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{conv.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {conv.model} · {formatDate(conv.createdAt)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(conv.id)
              }}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                deleting === conv.id
                  ? 'bg-red-900/30 text-red-400'
                  : 'opacity-0 group-hover:opacity-100 hover:bg-zinc-700 text-zinc-500 hover:text-red-400'
              )}
              title="Excluir conversa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleting(null)}>
          <div className="w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm text-zinc-200 font-medium">Excluir conversa?</p>
            <p className="text-xs text-zinc-500">Esta ação não pode ser desfeita.</p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteConversation(deleting)
                  setDeleting(null)
                }}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
