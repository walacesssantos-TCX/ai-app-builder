import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanCard } from '@/stores/kanban.store'

interface KanbanModalProps {
  card: KanbanCard | null
  onSave: (data: Partial<KanbanCard> & { title: string }) => void
  onDelete?: (cardId: string) => void
  onClose: () => void
}

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-zinc-600/40 text-zinc-400' },
  { value: 'medium', label: 'Medium', color: 'bg-brand/40 text-gold-400' },
  { value: 'high', label: 'High', color: 'bg-orange-600/40 text-orange-400' },
  { value: 'urgent', label: 'Urgent', color: 'bg-brand/40 text-brand-400' },
]

export function KanbanModal({ card, onSave, onDelete, onClose }: KanbanModalProps) {
  const [title, setTitle] = useState(card?.title || '')
  const [description, setDescription] = useState(card?.description || '')
  const [priority, setPriority] = useState<string>(card?.priority || 'medium')
  const [labelInput, setLabelInput] = useState('')
  const [labels, setLabels] = useState<string[]>(card?.labels || [])

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description)
      setPriority(card.priority)
      setLabels(card.labels || [])
    }
  }, [card])

  function handleSave() {
    if (!title.trim()) return
    onSave({ title: title.trim(), description, priority, labels } as any)
  }

  function handleAddLabel() {
    const trimmed = labelInput.trim()
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed])
      setLabelInput('')
    }
  }

  function handleRemoveLabel(label: string) {
    setLabels(labels.filter(l => l !== label))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">{card ? 'Editar card' : 'Novo card'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do card"
            className="w-full bg-zinc-800 text-zinc-100 text-sm px-3 py-2 rounded-lg border border-zinc-700 outline-none focus:border-zinc-500 placeholder-zinc-500"
            autoFocus
          />

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={3}
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-3 py-2 rounded-lg border border-zinc-700 outline-none focus:border-zinc-500 placeholder-zinc-500 resize-none"
          />

          <div>
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">Prioridade</label>
            <div className="flex gap-1.5">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn('text-[10px] uppercase font-medium px-2.5 py-1 rounded-md border transition-colors', p.color,
                    priority === p.value ? 'border-zinc-500 ring-1 ring-zinc-500' : 'border-transparent opacity-60 hover:opacity-100'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5 block">Labels</label>
            <div className="flex gap-1.5 flex-wrap mb-1.5">
              {labels.map(label => (
                <span key={label} className="flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
                  {label}
                  <button onClick={() => handleRemoveLabel(label)} className="hover:text-brand-400">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel() } }}
                placeholder="Adicionar label..."
                className="flex-1 bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500"
              />
              <button
                onClick={handleAddLabel}
                disabled={!labelInput.trim()}
                className="px-2.5 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
          {card && onDelete ? (
            <button
              onClick={() => onDelete(card.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-400 hover:bg-brand-900/30 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
