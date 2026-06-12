import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

interface ChatPanelProps {
  onNavigate?: (tab: string) => void
}

export function ChatPanel({ onNavigate }: ChatPanelProps) {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      <MessageList />
      <ChatInput onNavigate={onNavigate} />
    </div>
  )
}
