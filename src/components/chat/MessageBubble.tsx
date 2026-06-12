import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
  compact?: boolean
}

export function MessageBubble({ message, compact }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start',
        compact ? 'mb-1' : 'mb-4'
      )}
    >
      <div
        className={cn(
          compact ? 'max-w-[90%] rounded-lg px-3 py-1.5' : 'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : isSystem
              ? 'bg-yellow-900/30 text-yellow-200 border border-yellow-800/50 rounded-bl-md'
              : 'bg-zinc-800/50 text-zinc-100 border border-zinc-800 rounded-bl-md'
        )}
      >
        {isUser ? (
          <p className={cn(compact ? 'text-xs' : 'text-sm', 'whitespace-pre-wrap')}>{message.content}</p>
        ) : (
          <div className={cn('prose max-w-none', compact ? 'prose-xs' : 'prose-invert prose-sm')}>
            <ReactMarkdown
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className
                  if (isInline) {
                    return (
                      <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-sm text-emerald-300" {...props}>
                        {children}
                      </code>
                    )
                  }
                  return (
                    <pre className={cn(
                      'bg-zinc-900 rounded-lg overflow-x-auto border border-zinc-700',
                      compact ? 'p-2 my-1 text-xs' : 'p-4 my-2'
                    )}>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
