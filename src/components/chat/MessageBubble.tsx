import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'
import { DocumentDownload } from './DocumentDownload'

interface MessageBubbleProps {
  message: Message
  compact?: boolean
}

const TEXT_EXTENSIONS = new Set(['txt', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'cs', 'sql', 'html', 'css', 'md', 'csv', 'xml', 'yaml', 'yml', 'sh', 'ps1', 'bat', 'env', 'ini', 'cfg', 'log', 'toml', 'lock'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'])

function getFileIcon(name: string, mimeType: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTENSIONS.has(ext)) return '🖼️'
  if (AUDIO_EXTENSIONS.has(ext)) return '🎵'
  if (VIDEO_EXTENSIONS.has(ext)) return '🎬'
  if (ext === 'pdf') return '📄'
  if (ext === 'docx' || ext === 'doc') return '📝'
  if (mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(ext)) return '📃'
  return '📎'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageBubble({ message, compact }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const hasAttachments = message.attachments && message.attachments.length > 0

  function renderAttachment(file: import('@/types').FileAttachment) {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    if (AUDIO_EXTENSIONS.has(ext)) {
      return (
        <div key={file.name} className="space-y-1">
          <div className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg',
            isUser ? 'bg-white/10' : 'bg-zinc-900/50 border border-zinc-800'
          )}>
            <span className="text-base">🎵</span>
            <div className="flex-1 min-w-0">
              <p className={cn('truncate', compact ? 'text-[11px]' : 'text-xs')}>{file.name}</p>
              <p className={cn('opacity-60', compact ? 'text-[10px]' : 'text-[11px]')}>{formatSize(file.size)}</p>
            </div>
          </div>
          <audio
            controls
            className="w-full h-9 rounded-lg"
            src={`data:${file.mimeType};base64,${file.content}`}
            preload="metadata"
          >
            Seu navegador não suporta áudio.
          </audio>
        </div>
      )
    }

    if (IMAGE_EXTENSIONS.has(ext)) {
      return (
        <div key={file.name} className="space-y-1">
          <div className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg',
            isUser ? 'bg-white/10' : 'bg-zinc-900/50 border border-zinc-800'
          )}>
            <span className="text-base">🖼️</span>
            <div className="flex-1 min-w-0">
              <p className={cn('truncate', compact ? 'text-[11px]' : 'text-xs')}>{file.name}</p>
              <p className={cn('opacity-60', compact ? 'text-[10px]' : 'text-[11px]')}>{formatSize(file.size)}</p>
            </div>
          </div>
          <img
            src={`data:${file.mimeType};base64,${file.content}`}
            alt={file.name}
            className="max-w-full rounded-lg"
            loading="lazy"
          />
        </div>
      )
    }

    return (
      <div key={file.name} className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-lg',
        isUser ? 'bg-white/10' : 'bg-zinc-900/50 border border-zinc-800'
      )}>
        <span className="text-base">{getFileIcon(file.name, file.mimeType)}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('truncate', compact ? 'text-[11px]' : 'text-xs')}>{file.name}</p>
          <p className={cn('opacity-60', compact ? 'text-[10px]' : 'text-[11px]')}>{formatSize(file.size)}</p>
        </div>
      </div>
    )
  }

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
            ? 'bg-gradient-to-br from-brand to-brand-600 text-white rounded-br-md'
            : isSystem
              ? 'bg-yellow-900/30 text-yellow-200 border border-yellow-800/50 rounded-bl-md'
              : 'bg-zinc-800/50 text-zinc-100 border border-zinc-800 rounded-bl-md'
        )}
      >
        {hasAttachments && (
          <div className={cn('space-y-1.5', message.content ? 'mb-2' : '')}>
            {message.attachments!.map(renderAttachment)}
          </div>
        )}
        {isUser ? (
          <p className={cn(compact ? 'text-xs' : 'text-sm', 'whitespace-pre-wrap')}>{message.content}</p>
        ) : (
          <>
            <div className={cn('prose max-w-none', compact ? 'prose-xs' : 'prose-invert prose-sm')}>
              <ReactMarkdown
                components={{
                  code: ({ className, children, ...props }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-sm text-gold-300" {...props}>
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
            <DocumentDownload content={message.content} />
          </>
        )}
      </div>
    </div>
  )
}
