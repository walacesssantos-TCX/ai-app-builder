import { Pin, PinOff, FileText, Puzzle, Boxes, Code, PenTool, Atom, Headphones, GitBranch, MessageSquare, MessageCircle, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillMeta } from '@/types'
import type { LucideIcon } from 'lucide-react'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Marketing': Rocket,
  'Redes Sociais': MessageSquare,
  'Design': PenTool,
  'Figma': Atom,
  'Desenvolvimento': Code,
  'Claude AI': MessageCircle,
  'Escrita': FileText,
  'Documentos': FileText,
  'Áudio': Headphones,
  'Code Review': GitBranch,
  'Workflow': GitBranch,
  'Agentes': Boxes,
}

interface SkillCardProps {
  skill: SkillMeta
  isPinned: boolean
  onTogglePin: () => void
}

export function SkillCard({ skill, isPinned, onTogglePin }: SkillCardProps) {
  const Icon = skill.category ? CATEGORY_ICONS[skill.category] || Puzzle : Puzzle

  return (
    <div className={cn(
      'bg-zinc-900 border rounded-lg p-3 transition-colors',
      isPinned ? 'border-blue-500/30' : 'border-zinc-800 hover:border-zinc-700'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
            isPinned ? 'bg-blue-500/10' : 'bg-zinc-800'
          )}>
            <Icon className={cn('w-3.5 h-3.5', isPinned ? 'text-blue-400' : 'text-zinc-400')} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-100 truncate">{skill.name}</h3>
            {skill.category && (
              <span className="text-[10px] text-zinc-600">{skill.category}</span>
            )}
          </div>
        </div>
        <button
          onClick={onTogglePin}
          className={cn(
            'p-1.5 rounded transition-colors shrink-0',
            isPinned
              ? 'text-blue-400 hover:text-blue-300 bg-blue-500/10'
              : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
          )}
          title={isPinned ? 'Desafixar' : 'Fixar'}
        >
          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-2 line-clamp-2 leading-relaxed">{skill.description}</p>
      {skill.tags && skill.tags.length > 0 && (
        <div className="flex items-center flex-wrap gap-1 mt-2">
          {skill.tags.map(tag => (
            <span
              key={tag}
              className="text-[10px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
