import { useState, useEffect } from 'react'
import { Brain } from 'lucide-react'

const SIDECAR_URL = 'http://127.0.0.1:3001'

interface ModelsSectionProps {
  activeModel: string
  onModelChange: (model: string) => void
}

export function ModelsSection({ activeModel, onModelChange }: ModelsSectionProps) {
  const [availableModels, setAvailableModels] = useState<{ provider: string; models: string[] }[]>([])

  useEffect(() => {
    fetch(`${SIDECAR_URL}/models`)
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          const grouped: Record<string, string[]> = {}
          for (const model of data.models) {
            if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
              if (!grouped['OpenAI']) grouped['OpenAI'] = []
              grouped['OpenAI'].push(model)
            } else if (model.startsWith('claude-')) {
              if (!grouped['Anthropic']) grouped['Anthropic'] = []
              grouped['Anthropic'].push(model)
            } else if (model.startsWith('gemini-')) {
              if (!grouped['Gemini']) grouped['Gemini'] = []
              grouped['Gemini'].push(model)
            } else if (model.startsWith('deepseek-')) {
              if (!grouped['DeepSeek']) grouped['DeepSeek'] = []
              grouped['DeepSeek'].push(model)
            } else if (model.includes('mistral') || model.includes('codestral')) {
              if (!grouped['Mistral']) grouped['Mistral'] = []
              grouped['Mistral'].push(model)
            } else if (model.includes('llama') || model.includes('mixtral') || model.includes('gemma')) {
              if (!grouped['Groq']) grouped['Groq'] = []
              grouped['Groq'].push(model)
            } else if (model.startsWith('command-')) {
              if (!grouped['Cohere']) grouped['Cohere'] = []
              grouped['Cohere'].push(model)
            } else if (model.includes('/')) {
              if (!grouped['OpenRouter']) grouped['OpenRouter'] = []
              grouped['OpenRouter'].push(model)
            } else {
              if (!grouped['Outros']) grouped['Outros'] = []
              grouped['Outros'].push(model)
            }
          }
          const result = Object.entries(grouped).map(([provider, models]) => ({ provider, models }))
          setAvailableModels(result)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
        <Brain className="w-4 h-4 text-gold-400" /> Modelos de IA
      </h3>

      <div className="space-y-3">
        {availableModels.map(group => (
          <div key={group.provider}>
            <p className="text-[11px] uppercase text-zinc-600 font-medium mb-1.5">{group.provider}</p>
            <div className="space-y-1">
              {group.models.map(model => (
                <label
                  key={model}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    activeModel === model
                      ? 'bg-brand/10 border border-brand/30'
                      : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model}
                    checked={activeModel === model}
                    onChange={() => onModelChange(model)}
                    className="accent-red-600"
                  />
                  <span className="text-xs text-zinc-300">{model}</span>
                  {activeModel === model && (
                    <span className="ml-auto text-[10px] text-gold-400 bg-brand/20 px-1.5 py-0.5 rounded">Ativo</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
