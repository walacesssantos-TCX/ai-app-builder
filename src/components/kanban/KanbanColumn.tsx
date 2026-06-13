import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import type { KanbanColumn as KanbanColumnType, KanbanCard as KanbanCardType } from '@/stores/kanban.store'

const COLOR_MAP: Record<string, string> = {
  zinc: 'border-zinc-600/30',
  blue: 'border-brand/30',
  emerald: 'border-emerald-600/30',
  orange: 'border-orange-600/30',
  purple: 'border-purple-600/30',
  red: 'border-red-600/30',
  sky: 'border-sky-600/30',
}

const HEADER_COLOR_MAP: Record<string, string> = {
  zinc: 'bg-zinc-700/30 text-zinc-300',
  blue: 'bg-brand-600/30 text-gold-300',
  emerald: 'bg-brand-600/30 text-gold-300',
  orange: 'bg-orange-700/30 text-orange-300',
  purple: 'bg-purple-700/30 text-purple-300',
  red: 'bg-brand-600/30 text-red-300',
  sky: 'bg-sky-700/30 text-sky-300',
}

interface KanbanColumnProps {
  column: KanbanColumnType
  cards: KanbanCardType[]
  onAddCard: (columnId: string) => void
  onEditCard: (card: KanbanCardType) => void
  onDeleteCard: (cardId: string) => void
  onRenameColumn: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
  onChangeColor: (columnId: string, color: string) => void
}

const COLORS = ['zinc', 'blue', 'emerald', 'orange', 'purple', 'red', 'sky']

export function KanbanColumn({
  column,
  cards,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onRenameColumn,
  onDeleteColumn,
  onChangeColor,
}: KanbanColumnProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const sortedCards = [...cards].sort((a, b) => a.position - b.position)

  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      className={cn(
        'flex-shrink-0 w-72 flex flex-col bg-zinc-900/60 border rounded-lg',
        COLOR_MAP[column.color] || COLOR_MAP.zinc,
        isOver && 'ring-2 ring-emerald-500/30'
      )}
    >
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-lg', HEADER_COLOR_MAP[column.color] || HEADER_COLOR_MAP.zinc)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-current shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{column.title}</span>
          <span className="text-[10px] text-zinc-500 font-mono">{cards.length}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-black/20 text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setShowMenu(false); setShowColors(false) }} />
              <div className="absolute right-0 top-6 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                <button
                  onClick={() => { onRenameColumn(column.id); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Renomear
                </button>
                <button
                  onClick={() => { setShowColors(!showColors); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <div className="w-3 h-3 rounded-full bg-current" /> Cor
                </button>
                <button
                  onClick={() => { onDeleteColumn(column.id); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-brand-400 hover:bg-zinc-700 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            </>
          )}

          {showColors && (
            <div className="absolute right-0 top-6 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2">
              <div className="flex gap-1">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => { onChangeColor(column.id, color); setShowColors(false) }}
                    className={cn('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110', color === column.color ? 'border-white' : 'border-transparent')}
                    style={{ backgroundColor: color === 'zinc' ? '#71717a' : color === 'blue' ? '#3b82f6' : color === 'emerald' ? '#10b981' : color === 'orange' ? '#f97316' : color === 'purple' ? '#a855f7' : color === 'red' ? '#ef4444' : '#0ea5e9' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
        <SortableContext items={sortedCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {sortedCards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              columnColor={column.color}
            />
          ))}
        </SortableContext>

        {sortedCards.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <p className="text-[10px] text-zinc-700">Arraste cards aqui</p>
          </div>
        )}
      </div>

      <div className="px-2 pb-2">
        <button
          onClick={() => onAddCard(column.id)}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar card
        </button>
      </div>
    </div>
  )
}
