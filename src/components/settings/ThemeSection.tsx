import { themes, type ThemeId, useSettingsStore } from '@/stores/settings.store'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export function ThemeSection() {
  const { theme, setTheme } = useSettingsStore()

  return (
    <div className="space-y-4">
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
        <h3 className="text-sm font-medium text-zinc-100 mb-1">Tema do Aplicativo</h3>
        <p className="text-xs text-zinc-500 mb-4">Escolha o esquema de cores do Fluxcodex</p>

        <div className="grid grid-cols-3 gap-3">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-150',
                theme === t.id
                  ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/30'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
              )}
            >
              <div className="flex gap-1">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: t.colors['--brand'] }}
                />
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: t.colors['--gold'] }}
                />
              </div>
              <span className={cn(
                'text-xs',
                theme === t.id ? 'text-zinc-100' : 'text-zinc-400'
              )}>
                {t.label}
              </span>
              {theme === t.id && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
