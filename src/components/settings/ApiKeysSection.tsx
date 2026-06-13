import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { api, type ApiKeyDto } from '@/lib/api'

const PROVIDERS = ['anthropic', 'openai', 'openrouter', 'groq', 'gemini', 'deepseek', 'mistral', 'cohere'] as const

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyDto[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [provider, setProvider] = useState<string>('anthropic')
  const [name, setName] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.apiKeys.list().then(setKeys).catch(() => setError('Sidecar offline')).finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!name.trim() || !keyValue.trim()) return
    setError('')
    try {
      const created = await api.apiKeys.create({ provider, name: name.trim(), key: keyValue.trim() })
      setKeys(prev => [...prev, created])
      setName('')
      setKeyValue('')
      setShowAdd(false)
    } catch (e) {
      setError(`Falha ao adicionar key: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      await api.apiKeys.delete(id)
      setKeys(prev => prev.filter(k => k.id !== id))
    } catch {
      setError('Falha ao excluir key.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
          <Key className="w-4 h-4 text-gold-400" /> API Keys
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showAdd && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none"
          >
            {PROVIDERS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome (ex: Produção)"
            className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 rounded border border-zinc-700 outline-none placeholder-zinc-500"
          />
          <div className="relative">
            <input
              type={showKey['new'] ? 'text' : 'password'}
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-zinc-800 text-zinc-100 text-xs px-2.5 py-1.5 pr-8 rounded border border-zinc-700 outline-none placeholder-zinc-500 font-mono"
            />
            <button
              onClick={() => setShowKey(prev => ({ ...prev, 'new': !prev['new'] }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showKey['new'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!name.trim() || !keyValue.trim()}
              className="flex-1 px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-brand-400 bg-brand-900/30 border border-brand-800/30 rounded-lg px-3 py-2">{error}</div>
      )}

      {keys.length === 0 && !showAdd ? (
        <p className="text-xs text-zinc-600">{loading ? 'Carregando...' : 'Nenhuma API key configurada.'}</p>
      ) : (
        <div className="space-y-1.5">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-200">{k.name}</span>
                  <span className="text-[10px] uppercase text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{k.provider}</span>
                </div>
                <p className="text-[11px] text-zinc-600 font-mono mt-0.5">{k.keyHash}</p>
              </div>
              <button
                onClick={() => handleDelete(k.id)}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-brand-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
