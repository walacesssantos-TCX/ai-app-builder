import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { FileEntry, FluxcodexPaths, SkillMeta, TerminalEvent } from '@/types'

export async function readFile(path: string): Promise<string> {
  return invoke('read_file', { path })
}

export async function writeFile(path: string, content: string): Promise<void> {
  return invoke('write_file', { path, content })
}

export async function deleteFile(path: string): Promise<void> {
  return invoke('delete_file', { path })
}

export async function listDir(path: string): Promise<FileEntry[]> {
  return invoke('list_dir', { path })
}

export async function getFileTree(path: string): Promise<string> {
  return invoke('get_file_tree', { path })
}

export async function searchFiles(path: string, query: string): Promise<Array<{ path: string; line: number; content: string }>> {
  return invoke('search_files', { path, query })
}

export async function getFluxcodexPaths(): Promise<FluxcodexPaths> {
  return invoke('get_fluxcodex_paths')
}

export async function createTerminal(sessionId: string, cwd: string): Promise<void> {
  return invoke('create_terminal', { sessionId, cwd })
}

export async function writeTerminal(sessionId: string, input: string): Promise<void> {
  return invoke('write_terminal', { sessionId, input })
}

export async function killTerminal(sessionId: string): Promise<void> {
  return invoke('kill_terminal', { sessionId })
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke('resize_terminal', { sessionId, cols, rows })
}

export async function discoverSkills(projectPath: string): Promise<SkillMeta[]> {
  return invoke('discover_skills', { projectPath })
}

export async function readSkill(skillPath: string): Promise<SkillMeta> {
  return invoke('read_skill', { skillPath })
}

export async function gitBranches(path: string): Promise<string[]> {
  return invoke('git_branches', { path })
}

export async function getHwid(): Promise<string> {
  return invoke('get_hwid')
}

export async function openFileDialog(): Promise<string | null> {
  return invoke('open_file_dialog')
}

export async function openFolderDialog(): Promise<string | null> {
  return invoke('open_folder_dialog')
}

export function onTerminalOutput(sessionId: string, callback: (event: TerminalEvent) => void): Promise<() => void> {
  return listen<TerminalEvent>(`terminal:${sessionId}`, (e) => callback(e.payload)).then(fn => fn)
}

if (typeof invoke === 'undefined' || typeof listen === 'undefined') {
  console.warn('Tauri APIs not available. Running in browser mode.')
}
