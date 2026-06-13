import { useState, useEffect, useRef } from 'react'
import { X, Save, RotateCcw, Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillMeta, ToolDef } from '@/types'
import { useSkillsStore } from '@/stores/skills.store'

interface SkillEditorProps {
  open: boolean
  onClose: () => void
  skill?: SkillMeta | null
  onSave?: (skill: SkillMeta) => void
}

const DEFAULT_CATEGORIES = [
  'Marketing', 'Redes Sociais', 'Design', 'Figma', 'Desenvolvimento',
  'Claude AI', 'Escrita', 'Documentos', 'Áudio', 'Code Review', 'Workflow', 'Agentes',
]

export function SkillEditor({ open, onClose, skill, onSave }: SkillEditorProps) {
  const { available, setAvailable } = useSkillsStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [priority, setPriority] = useState(5)
  const [customCategory, setCustomCategory] = useState('')
  const [tools, setTools] = useState<ToolDef[]>([])
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const isEditing = !!skill

  useEffect(() => {
    if (open) {
      if (skill) {
        setName(skill.name)
        setDescription(skill.description || '')
        setContent(skill.content || '')
        setCategory(skill.category || '')
        setTagsInput((skill.tags || []).join(', '))
        setPriority(skill.priority || 5)
        setTools(skill.tools || [])
        setCustomCategory('')
      } else {
        setName('')
        setDescription('')
        setContent('')
        setCategory('')
        setTagsInput('')
        setPriority(5)
        setTools([])
        setCustomCategory('')
      }
      setTimeout(() => nameRef.current?.focus(), 100)
    }
  }, [open, skill])

  const tags = tagsInput
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...available.map(s => s.category).filter(Boolean as unknown as (s: string | undefined) => s is string), customCategory].filter(Boolean))]

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)

    const updated: SkillMeta = {
      name: name.trim(),
      description: description.trim(),
      content,
      path: skill?.path || `builtin://${name.trim()}`,
      priority,
      category: category || customCategory || undefined,
      tags: tags.length > 0 ? tags : undefined,
      tools: tools.filter(t => t.name.trim()),
    }

    try {
      if (isEditing) {
        const exists = available.findIndex(s => s.name === skill.name)
        if (exists >= 0) {
          const next = [...available]
          next[exists] = updated
          setAvailable(next)
        }
      } else {
        setAvailable([...available, updated])
      }
      onSave?.(updated)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const addTool = () => {
    setTools([...tools, { name: '', description: '', exec: '', permissions: [] }])
  }

  const updateTool = (index: number, field: keyof ToolDef, value: string | string[]) => {
    setTools(tools.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const removeTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index))
  }

  const isValid = name.trim().length > 0

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            {isEditing ? `Editar Skill: ${skill.name}` : 'Nova Skill'}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (skill) {
                  setName(skill.name)
                  setDescription(skill.description || '')
                  setContent(skill.content || '')
                  setCategory(skill.category || '')
                  setTagsInput((skill.tags || []).join(', '))
                  setPriority(skill.priority || 5)
                  setTools(skill.tools || [])
                }
              }}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Restaurar valores originais"
              disabled={!isEditing}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Nome <span className="text-brand-400">*</span></label>
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="minha-skill"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Categoria</label>
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value); setCustomCategory('') }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-500 transition-colors"
                >
                  <option value="">Sem categoria</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__custom__">Customizada...</option>
                </select>
                {category === '__custom__' && (
                  <input
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    placeholder="Nova categoria"
                    className="w-32 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o propósito desta skill..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Conteúdo (system prompt)</label>
              <span className="text-[10px] text-zinc-600">{content.length} caracteres</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="# Minha Skill\n\nRegras e instruções detalhadas para o comportamento do modelo..."
              rows={12}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors font-mono resize-vertical"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Tags</label>
              <input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="marketing, estratégia, copy"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
              />
              {tags.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 mt-1">
                  {tags.map(tag => (
                    <span key={tag} className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Prioridade</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  className="flex-1 accent-red-600 h-1.5"
                />
                <span className={cn(
                  'text-xs font-mono w-5 text-center',
                  priority >= 7 ? 'text-gold-400' : priority >= 4 ? 'text-gold-400' : 'text-zinc-500'
                )}>
                  {priority}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Ferramentas (MCP Tools)</label>
              <button
                onClick={addTool}
                className="flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors"
              >
                <Plus className="w-3 h-3" /> Adicionar ferramenta
              </button>
            </div>

            {tools.length === 0 && (
              <p className="text-[11px] text-zinc-600 italic">Nenhuma ferramenta definida</p>
            )}

            <div className="space-y-2">
              {tools.map((tool, index) => (
                <div key={index} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0 cursor-grab" />
                    <input
                      value={tool.name}
                      onChange={e => updateTool(index, 'name', e.target.value)}
                      placeholder="tool_name"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors font-mono"
                    />
                    <button
                      onClick={() => removeTool(index)}
                      className="p-1 rounded text-zinc-500 hover:text-brand-400 hover:bg-zinc-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={tool.description}
                    onChange={e => updateTool(index, 'description', e.target.value)}
                    placeholder="Descrição da ferramenta"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                  />
                  <div className="flex gap-2">
                    <input
                      value={tool.exec}
                      onChange={e => updateTool(index, 'exec', e.target.value)}
                      placeholder="Comando a executar"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors font-mono"
                    />
                    <input
                      value={tool.permissions.join(', ')}
                      onChange={e => updateTool(index, 'permissions', e.target.value.split(',').map(p => p.trim()).filter(Boolean))}
                      placeholder="Permissões (read, write)"
                      className="w-40 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 shrink-0">
          <p className="text-[11px] text-zinc-600">
            {tags.length > 0 && `${tags.length} tag${tags.length > 1 ? 's' : ''}`}
            {tools.length > 0 && ` · ${tools.length} ferramenta${tools.length > 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors',
                isValid && !saving
                  ? 'bg-brand text-white hover:bg-blue-500'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar Skill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
