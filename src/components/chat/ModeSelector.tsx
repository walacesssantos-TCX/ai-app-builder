import { useChatStore } from '@/stores/chat.store'
import { cn } from '@/lib/utils'
import type { ChatMode } from '@/types'

const modes: { id: ChatMode; label: string; description: string }[] = [
  { id: 'chat', label: 'Chat', description: 'Conversa simples' },
  { id: 'agent', label: 'Agent', description: 'Executa ações' },
  { id: 'think', label: 'Think', description: 'Raciocínio estendido' },
]

export function ModeSelector() {
  const { mode, setMode } = useChatStore()

  return (
    <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          title={m.description}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all duration-150',
            mode === m.id
              ? 'bg-brand text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
