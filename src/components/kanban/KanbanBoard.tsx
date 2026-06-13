import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Plus, Columns, LayoutList } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import { useKanbanStore, type KanbanCard } from '@/stores/kanban.store'
import { KanbanColumn } from './KanbanColumn'
import { KanbanModal } from './KanbanModal'
import { KanbanCard as KanbanCardComponent } from './KanbanCard'

export function KanbanBoard() {
  const { activeProject } = useProjectStore()
  const {
    data, loading, editingCard, showCardModal,
    load, addColumn, updateColumn, deleteColumn,
    addCard, updateCard, deleteCard, moveCard,
    dragOverMove, dragEndReorder,
    setEditingCard, setShowCardModal,
  } = useKanbanStore()

  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [showNewColumn, setShowNewColumn] = useState(false)
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)

  useEffect(() => {
    if (activeProject?.path) {
      load(activeProject.path)
    }
  }, [activeProject?.path, load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function findColumn(cardId: string): string | null {
    for (const card of data.cards) {
      if (card.id === cardId) return card.columnId
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeColumn = findColumn(active.id as string)
    const overColumn = over.id in ['todo', 'progress', 'done'] || data.columns.some(c => c.id === over.id)
      ? (over.id as string)
      : findColumn(over.id as string)

    if (!activeColumn || !overColumn || activeColumn === overColumn) return
    dragOverMove(active.id as string, overColumn, over.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id || !activeProject?.path) return

    const activeColumn = findColumn(active.id as string)
    const overColumn = over.id in ['todo', 'progress', 'done'] || data.columns.some(c => c.id === over.id)
      ? (over.id as string)
      : findColumn(over.id as string)

    if (!activeColumn || !overColumn) return

    if (activeColumn === overColumn) {
      dragEndReorder(active.id as string, over.id as string)
    }

    const card = data.cards.find(c => c.id === active.id)
    if (!card) return

    const destCards = data.cards
      .filter(c => c.columnId === overColumn)
      .sort((a, b) => a.position - b.position)
    const newIndex = destCards.findIndex(c => c.id === over.id)

    moveCard(activeProject.path, active.id as string, overColumn, newIndex >= 0 ? newIndex : destCards.length)
  }

  async function handleAddCard(columnId: string) {
    setEditingColumnId(columnId)
    setEditingCard(null)
    setShowCardModal(true)
  }

  async function handleSaveCard(data_: Partial<KanbanCard> & { title: string }) {
    if (!activeProject?.path) return

    if (editingCard) {
      await updateCard(activeProject.path, editingCard.id, data_)
    } else {
      await addCard(activeProject.path, { ...data_, columnId: editingColumnId! })
    }
    setShowCardModal(false)
    setEditingCard(null)
  }

  async function handleDeleteCard(cardId: string) {
    if (!activeProject?.path) return
    await deleteCard(activeProject.path, cardId)
    setShowCardModal(false)
    setEditingCard(null)
  }

  async function handleAddColumn() {
    if (!newColumnTitle.trim() || !activeProject?.path) return
    await addColumn(activeProject.path, newColumnTitle.trim())
    setNewColumnTitle('')
    setShowNewColumn(false)
  }

  function handleStartRename(columnId: string) {
    const col = data.columns.find(c => c.id === columnId)
    if (col) {
      setRenamingColumn(columnId)
      setRenameValue(col.title)
    }
  }

  async function handleFinishRename() {
    if (!renamingColumn || !activeProject?.path) return
    if (renameValue.trim()) {
      await updateColumn(activeProject.path, renamingColumn, { title: renameValue.trim() })
    }
    setRenamingColumn(null)
  }

  async function handleChangeColor(columnId: string, color: string) {
    if (!activeProject?.path) return
    await updateColumn(activeProject.path, columnId, { color })
  }

  async function handleDeleteColumnHandler(columnId: string) {
    if (!activeProject?.path) return
    await deleteColumn(activeProject.path, columnId)
  }

  const activeCard = activeId ? data.cards.find(c => c.id === activeId) : null

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Columns className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-600">Selecione um projeto para usar o Kanban Board.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <LayoutList className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Kanban Board</h2>
          <span className="text-[10px] text-zinc-600 font-mono">{activeProject.name}</span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full items-start min-h-[200px]">
            {data.columns.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={data.cards.filter(c => c.columnId === column.id)}
                onAddCard={handleAddCard}
                onEditCard={(card) => { setEditingCard(card); setShowCardModal(true) }}
                onDeleteCard={(cardId) => deleteCard(activeProject.path, cardId)}
                onRenameColumn={handleStartRename}
                onDeleteColumn={handleDeleteColumnHandler}
                onChangeColor={handleChangeColor}
              />
            ))}

            <div className="flex-shrink-0 w-72">
              {showNewColumn ? (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-2 space-y-2">
                  {renamingColumn ? (
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setRenamingColumn(null) }}
                      className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none"
                      autoFocus
                    />
                  ) : (
                    <input
                      value={newColumnTitle}
                      onChange={e => setNewColumnTitle(e.target.value)}
                      placeholder="Nome da coluna"
                      className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') setShowNewColumn(false) }}
                    />
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddColumn}
                      disabled={!newColumnTitle.trim()}
                      className="flex-1 px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
                    >
                      Adicionar
                    </button>
                    <button
                      onClick={() => { setShowNewColumn(false); setNewColumnTitle('') }}
                      className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewColumn(true)}
                  className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 border border-dashed border-zinc-800 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar coluna
                </button>
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-72 opacity-90">
              <KanbanCardComponent
                card={activeCard}
                onEdit={() => {}}
                onDelete={() => {}}
                columnColor="zinc"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showCardModal && (
        <KanbanModal
          card={editingCard}
          onSave={handleSaveCard}
          onDelete={editingCard ? handleDeleteCard : undefined}
          onClose={() => { setShowCardModal(false); setEditingCard(null) }}
        />
      )}
    </div>
  )
}
