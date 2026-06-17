import { useEffect } from 'react'
import { themes, useSettingsStore } from '@/stores/settings.store'

export function useTheme() {
  const themeId = useSettingsStore(s => s.theme)

  useEffect(() => {
    const theme = themes.find(t => t.id === themeId)
    if (!theme) return

    const root = document.documentElement
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(key, value)
    }
  }, [themeId])
}
