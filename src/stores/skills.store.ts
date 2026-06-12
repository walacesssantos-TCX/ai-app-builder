import { create } from 'zustand'
import type { SkillMeta, Skill } from '@/types'
import { BUILTIN_SKILLS } from '@/data/builtinSkills'

interface SkillsStore {
  available: SkillMeta[]
  active: Skill[]
  pinned: string[]

  setAvailable: (skills: SkillMeta[]) => void
  pin: (skillName: string) => void
  unpin: (skillName: string) => void
  activateSkills: (skills: Skill[]) => void
  isPinned: (skillName: string) => boolean
}

const SEED_SKILLS: SkillMeta[] = BUILTIN_SKILLS.map(s => ({
  name: s.name,
  description: s.description,
  content: '',
  path: `builtin://${s.name}`,
  priority: s.priority,
  category: s.category,
  tags: s.tags,
}))

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  available: SEED_SKILLS,
  active: [],
  pinned: [],

  setAvailable: (skills) => set({ available: skills }),

  pin: (skillName) =>
    set((state) => ({
      pinned: [...state.pinned, skillName],
    })),

  unpin: (skillName) =>
    set((state) => ({
      pinned: state.pinned.filter((s) => s !== skillName),
    })),

  activateSkills: (skills) => set({ active: skills }),

  isPinned: (skillName) => get().pinned.includes(skillName),
}))
