import { useState, useEffect, useRef } from 'react'
import { SplitSquareHorizontal, Send, Loader, AlertCircle, CheckCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import ReactMarkdown from 'react-markdown'

const SIDECAR_URL = 'http://127.0.0.1:3001'

interface CompareResult {
  model: string
  content: string
  error?: string
}

export function ComparePanel() {
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(true)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<CompareResult[]>([])
  const availableModels = useSettingsStore(s => s.availableModels)
  const abortRef = useRef<AbortController | null>(null)

  const allModels = availableModels.flatMap(p => p.models)

  const [selectedModels, setSelectedModels] = useState<string[]>([])

  // Update selectedModels when models load asynchronously
  useEffect(() => {
    if (selectedModels.length === 0 && allModels.length >= 2) {
      setSelectedModels(allModels.slice(0, 3))
    }
  }, [allModels])

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const toggleModel = (m: string) => {
    setSelectedModels(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const handleCompare = async () => {
    if (!prompt.trim() || selectedModels.length < 2) return
    setRunning(true)
    setResults([])
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${SIDECAR_URL}/chat/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), models: selectedModels }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(await res.text())
      const data: CompareResult[] = await res.json()
      if (!controller.signal.aborted) setResults(data)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (!controller.signal.aborted) setResults([{ model: 'error', content: '', error: String(e) }])
    } finally {
      if (!controller.signal.aborted) setRunning(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <SplitSquareHorizontal className="w-4 h-4 text-gold-400" /> Comparar Modelos
        </h2>
        {results.length > 0 && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showPrompt ? 'Ocultar prompt' : 'Mostrar prompt'}
          </button>
        )}
      </div>

      {showPrompt && (
        <div className="px-4 pt-3 pb-2 border-b border-zinc-800/50">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Digite o prompt para comparar entre modelos..."
            rows={3}
            className="w-full bg-zinc-900 text-zinc-100 text-sm px-3 py-2 rounded-lg border border-zinc-800 resize-none outline-none placeholder-zinc-600"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-wrap gap-1.5">
              {allModels.slice(0, 12).map(m => {
                const active = selectedModels.includes(m)
                return (
                  <button
                    key={m}
                    onClick={() => toggleModel(m)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-brand/20 border-blue-600/40 text-gold-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleCompare}
              disabled={!prompt.trim() || selectedModels.length < 2 || running}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-brand hover:bg-brand-600 text-white disabled:opacity-40 transition-colors"
            >
              {running ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Comparar
            </button>
          </div>
        </div>
      )}

      {running && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader className="w-4 h-4 animate-spin" />
            Executando {selectedModels.length} modelos em paralelo...
          </div>
        </div>
      )}

      {results.length > 0 && !running && (
        <div className="flex-1 flex overflow-x-auto">
          {results.map(r => (
            <div key={r.model} className="flex-1 min-w-[280px] max-w-[50%] border-r border-zinc-800/50 last:border-r-0 flex flex-col">
              <div className="px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/50 sticky top-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-200">{r.model}</span>
                  {r.error ? (
                    <AlertCircle className="w-3.5 h-3.5 text-brand-400" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-gold-400" />
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {r.error ? (
                  <div className="text-xs text-brand-400 bg-brand-900/30 rounded-lg px-3 py-2">{r.error}</div>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none text-xs text-zinc-300 [&_pre]:bg-zinc-900 [&_code]:text-zinc-200">
                    <ReactMarkdown>{r.content || '(vazio)'}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !running && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <SplitSquareHorizontal className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Selecione 2+ modelos e envie um prompt</p>
            <p className="text-xs text-zinc-700 mt-1">Resultados aparecerão lado a lado</p>
          </div>
        </div>
      )}
    </div>
  )
}
