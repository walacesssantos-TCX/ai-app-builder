import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'
import { api } from '@/lib/api'

export interface KanbanCard {
  id: string
  title: string
  description: string
  columnId: string
  position: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
  labels: string[]
  createdAt: string
  updatedAt: string
}

export interface KanbanColumn {
  id: string
  title: string
  color: string
}

export interface KanbanData {
  columns: KanbanColumn[]
  cards: KanbanCard[]
}

interface KanbanStore {
  data: KanbanData
  loading: boolean
  editingCard: KanbanCard | null
  showCardModal: boolean
  load: (projectPath: string) => Promise<void>
  addColumn: (projectPath: string, title: string, color?: string) => Promise<void>
  updateColumn: (projectPath: string, columnId: string, updates: { title?: string; color?: string }) => Promise<void>
  deleteColumn: (projectPath: string, columnId: string) => Promise<void>
  addCard: (projectPath: string, card: Partial<KanbanCard> & { title: string; columnId: string }) => Promise<void>
  updateCard: (projectPath: string, cardId: string, updates: Partial<KanbanCard>) => Promise<void>
  deleteCard: (projectPath: string, cardId: string) => Promise<void>
  moveCard: (projectPath: string, cardId: string, toColumnId: string, toPosition: number) => Promise<void>
  dragOverMove: (cardId: string, overColumnId: string, overId: string) => void
  dragEndReorder: (cardId: string, overId: string) => void
  setEditingCard: (card: KanbanCard | null) => void
  setShowCardModal: (show: boolean) => void
}

const DEFAULT_DATA: KanbanData = {
  columns: [
    { id: 'todo', title: 'To Do', color: 'zinc' },
    { id: 'progress', title: 'In Progress', color: 'blue' },
    { id: 'done', title: 'Done', color: 'emerald' },
  ],
  cards: [],
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  data: DEFAULT_DATA,
  loading: false,
  editingCard: null,
  showCardModal: false,

  load: async (projectPath: string) => {
    set({ loading: true })
    try {
      const { board } = await api.kanban.get(projectPath)
      if (board) {
        set({ data: { columns: board.columns || [], cards: (board.cards || []).sort((a: KanbanCard, b: KanbanCard) => a.position - b.position) } })
      } else {
        set({ data: DEFAULT_DATA })
      }
    } catch {
      set({ data: DEFAULT_DATA })
    } finally {
      set({ loading: false })
    }
  },

  addColumn: async (projectPath: string, title: string, color?: string) => {
    const { column } = await api.kanban.addColumn(projectPath, { title, color })
    set(state => ({ data: { ...state.data, columns: [...state.data.columns, column] } }))
  },

  updateColumn: async (projectPath: string, columnId: string, updates) => {
    await api.kanban.updateColumn(projectPath, columnId, updates)
    set(state => ({
      data: {
        ...state.data,
        columns: state.data.columns.map(c => c.id === columnId ? { ...c, ...updates } : c),
      },
    }))
  },

  deleteColumn: async (projectPath: string, columnId: string) => {
    await api.kanban.deleteColumn(projectPath, columnId)
    set(state => ({
      data: {
        columns: state.data.columns.filter(c => c.id !== columnId),
        cards: state.data.cards.filter(c => c.columnId !== columnId),
      },
    }))
  },

  addCard: async (projectPath: string, card) => {
    const { card: created } = await api.kanban.addCard(projectPath, card as any)
    set(state => ({ data: { ...state.data, cards: [...state.data.cards, created] } }))
  },

  updateCard: async (projectPath: string, cardId: string, updates) => {
    await api.kanban.updateCard(projectPath, cardId, updates)
    set(state => ({
      data: {
        ...state.data,
        cards: state.data.cards.map(c => c.id === cardId ? { ...c, ...updates } : c),
      },
    }))
  },

  deleteCard: async (projectPath: string, cardId: string) => {
    await api.kanban.deleteCard(projectPath, cardId)
    set(state => ({
      data: { ...state.data, cards: state.data.cards.filter(c => c.id !== cardId) },
    }))
  },

  dragOverMove: (cardId: string, overColumnId: string, overId: string) => {
    const state = get()
    const card = state.data.cards.find(c => c.id === cardId)
    if (!card) return

    const targetCards = state.data.cards.filter(c => c.columnId === overColumnId)
    const overIndex = targetCards.findIndex(c => c.id === overId)

    const newCards = state.data.cards.map(c => {
      if (c.id === cardId) return { ...c, columnId: overColumnId, position: overIndex >= 0 ? overIndex : targetCards.length, updatedAt: new Date().toISOString() }
      return c
    })
    set({ data: { ...state.data, cards: newCards } })
  },

  dragEndReorder: (cardId: string, overId: string) => {
    const state = get()
    const card = state.data.cards.find(c => c.id === cardId)
    if (!card) return

    const columnCards = state.data.cards
      .filter(c => c.columnId === card.columnId)
      .sort((a, b) => a.position - b.position)

    const oldIndex = columnCards.findIndex(c => c.id === cardId)
    const newIndex = columnCards.findIndex(c => c.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(columnCards, oldIndex, newIndex).map((c, i) => ({
      ...c,
      position: i,
      updatedAt: new Date().toISOString(),
    }))

    const updatedCards = state.data.cards.map(c => {
      const found = reordered.find(r => r.id === c.id)
      return found || c
    })
    set({ data: { ...state.data, cards: updatedCards } })
  },

  moveCard: async (projectPath: string, cardId: string, toColumnId: string, toPosition: number) => {
    const card = get().data.cards.find(c => c.id === cardId)
    if (!card) return

    const cardsBefore = JSON.stringify(get().data.cards)

    const updatedCards = get().data.cards.map(c => {
      if (c.id === cardId) return { ...c, columnId: toColumnId, position: toPosition, updatedAt: new Date().toISOString() }
      if (c.columnId === toColumnId && c.position >= toPosition) return { ...c, position: c.position + 1 }
      if (c.columnId === card.columnId && c.position > card.position) return { ...c, position: c.position - 1 }
      return c
    })

    set(state => ({ data: { ...state.data, cards: updatedCards } }))

    try {
      await api.kanban.reorder(projectPath, [
        { id: cardId, columnId: toColumnId, position: toPosition },
      ])
    } catch {
      set(state => ({ data: { ...state.data, cards: JSON.parse(cardsBefore) } }))
    }
  },

  setEditingCard: (card) => set({ editingCard: card }),
  setShowCardModal: (show) => set({ showCardModal: show }),
}))
