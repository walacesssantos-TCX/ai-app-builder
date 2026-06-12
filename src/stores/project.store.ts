import { create } from 'zustand'
import type { Project, OpenFile } from '@/types'
import { api } from '@/lib/api'

interface ProjectStore {
  projects: Project[]
  activeProject: Project | null
  openFiles: OpenFile[]
  activeFileId: string | null
  loaded: boolean

  setProjects: (projects: Project[]) => void
  setActiveProject: (project: Project | null) => void
  openFile: (file: OpenFile) => void
  closeFile: (id: string) => void
  setActiveFile: (id: string | null) => void
  updateFileContent: (id: string, content: string) => void
  markFileClean: (id: string) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  loadProjects: () => Promise<void>
  createProject: (name: string, path: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProject: null,
  openFiles: [],
  activeFileId: null,
  loaded: false,

  setProjects: (projects) => set({ projects }),

  setActiveProject: (project) => set({ activeProject: project }),

  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.find((f) => f.id === file.id)
      if (exists) {
        return { activeFileId: file.id }
      }
      return {
        openFiles: [...state.openFiles, file],
        activeFileId: file.id,
      }
    }),

  closeFile: (id) =>
    set((state) => {
      const files = state.openFiles.filter((f) => f.id !== id)
      const activeId = state.activeFileId === id
        ? (files[files.length - 1]?.id ?? null)
        : state.activeFileId
      return { openFiles: files, activeFileId: activeId }
    }),

  setActiveFile: (id) => set({ activeFileId: id }),

  updateFileContent: (id, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.id === id ? { ...f, content, isDirty: true } : f
      ),
    })),

  markFileClean: (id) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.id === id ? { ...f, isDirty: false } : f
      ),
    })),

  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  removeProject: (id: string) =>
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      activeProject: state.activeProject?.id === id ? null : state.activeProject,
    })),

  loadProjects: async () => {
    try {
      const dtos = await api.projects.list()
      const projects: Project[] = dtos.map(d => ({
        id: d.id,
        name: d.name,
        path: d.path,
        description: d.description,
        conversationCount: d.conversationCount,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }))
      set({ projects, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  createProject: async (name: string, path: string) => {
    try {
      const dto = await api.projects.create({ name, path })
      const project: Project = {
        id: dto.id,
        name: dto.name,
        path: dto.path,
        description: dto.description,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
      }
      set((state) => ({
        projects: [...state.projects, project],
        activeProject: project,
      }))
    } catch {
      const project: Project = {
        id: crypto.randomUUID(),
        name,
        path,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      set((state) => ({
        projects: [...state.projects, project],
        activeProject: project,
      }))
    }
  },

  deleteProject: async (id: string) => {
    try {
      await api.projects.delete(id)
    } catch {
      // proceed with local removal anyway
    }
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      activeProject: state.activeProject?.id === id ? null : state.activeProject,
    }))
  },
}))
