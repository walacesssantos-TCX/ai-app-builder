import { useState } from 'react'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KanbanCard as KanbanCardType } from '@/stores/kanban.store'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-zinc-600/40 text-zinc-400',
  medium: 'bg-brand/40 text-gold-400',
  high: 'bg-orange-600/40 text-orange-400',
  urgent: 'bg-brand/40 text-brand-400',
}

interface KanbanCardProps {
  card: KanbanCardType
  onEdit: (card: KanbanCardType) => void
  onDelete: (cardId: string) => void
  columnColor: string
}

export function KanbanCard({ card, onEdit, onDelete, columnColor }: KanbanCardProps) {
  const [showActions, setShowActions] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 cursor-pointer hover:border-zinc-600 transition-colors',
        isDragging && 'opacity-50 ring-2 ring-emerald-500/30'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => onEdit(card)}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-200 leading-snug break-words">{card.title}</p>
          {card.description && (
            <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{card.description}</p>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={cn('text-[9px] uppercase font-medium px-1.5 py-0.5 rounded', PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.medium)}>
              {card.priority}
            </span>
            {card.labels?.map(label => (
              <span key={label} className="text-[9px] bg-zinc-700/60 text-zinc-400 px-1.5 py-0.5 rounded">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showActions && (
        <div className="absolute top-1.5 right-1.5 flex gap-0.5 bg-zinc-800 rounded-md border border-zinc-700 shadow-lg">
          <button
            onClick={e => { e.stopPropagation(); onEdit(card) }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(card.id) }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-brand-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
