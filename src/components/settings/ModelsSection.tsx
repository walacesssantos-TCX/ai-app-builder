import { useState, useEffect } from 'react'
import { Brain } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

const DEFAULT_MODELS = [
  { provider: 'Local', models: ['qwen3.5:4b', 'fluxcodex-qwen35-native'] },
]

interface ModelsSectionProps {
  activeModel: string
  onModelChange: (model: string) => void
}

export function ModelsSection({ activeModel, onModelChange }: ModelsSectionProps) {
  const [availableModels, setAvailableModels] = useState<{ provider: string; models: string[] }[]>(DEFAULT_MODELS)

  useEffect(() => {
    Promise.all([
      invoke<{ provider: string; models: string[] }[]>('ai_models'),
      invoke<{ provider: string; models: string[] }[]>('cloud_models'),
    ])
      .then(([local, cloud]) => {
        const combined = [...local, ...cloud]
        setAvailableModels(combined)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
        <Brain className="w-4 h-4 text-purple-400" /> Modelos de IA
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
                      ? 'bg-blue-600/10 border border-blue-600/30'
                      : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model}
                    checked={activeModel === model}
                    onChange={() => onModelChange(model)}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-zinc-300">{model}</span>
                  {activeModel === model && (
                    <span className="ml-auto text-[10px] text-blue-400 bg-blue-600/20 px-1.5 py-0.5 rounded">Ativo</span>
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
