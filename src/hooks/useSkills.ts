import { useCallback } from 'react'
import { useSkillsStore } from '@/stores/skills.store'

const STORAGE_KEY = 'aibuilder-pinned-skills'

export function useSkills() {
  const { available, pinned, setAvailable, pin, unpin, activateSkills } = useSkillsStore()

  const loadPersistedPins = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const pinnedNames = JSON.parse(saved) as string[]
        pinnedNames.forEach((name) => pin(name))
      }
    } catch {
      // ignore
    }
  }, [pin])

  const togglePin = useCallback((skillName: string) => {
    const isPinned = useSkillsStore.getState().pinned.includes(skillName)
    if (isPinned) {
      unpin(skillName)
    } else {
      pin(skillName)
    }
    const newPinned = useSkillsStore.getState().pinned
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPinned))
  }, [pin, unpin])

  return {
    available,
    pinned,
    setAvailable,
    activateSkills,
    togglePin,
    loadPersistedPins,
  }
}
