import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Folder, File, FileCode, FileText, FileJson, Image, Terminal, Database, Plus, FilePlus, FolderPlus, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listDir, readFile, deleteFile, createDirectory, writeFile } from '@/lib/filesystem'
import { useProjectStore } from '@/stores/project.store'
import type { FileEntry } from '@/types'

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  expanded: boolean
  loading?: boolean
}

function getFileIcon(name: string, isDir: boolean): typeof File {
  if (isDir) return Folder
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx': return FileCode
    case 'json': return FileJson
    case 'md': return FileText
    case 'css': case 'scss': case 'less': return FileText
    case 'html': case 'htm': return FileCode
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'ico': return Image
    case 'sql': case 'db': return Database
    case 'ps1': case 'sh': case 'bat': return Terminal
    default: return File
  }
}

async function loadTree(dir: string): Promise<TreeNode[]> {
  const entries = await listDir(dir)
  const nodes: TreeNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    nodes.push({
      ...entry,
      expanded: false,
      children: entry.isDir ? [] : undefined,
    })
  }
  return nodes
}

interface ContextMenu {
  x: number
  y: number
  target: TreeNode | null
}

export function FileExplorer() {
  const { activeProject, openFile } = useProjectStore()
  const [root, setRoot] = useState<TreeNode[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshTree = useCallback(async () => {
    if (!activeProject?.path) return
    const tree = await loadTree(activeProject.path)
    setRoot(tree)
  }, [activeProject?.path])

  useEffect(() => {
    if (activeProject?.path) refreshTree()
    else setRoot([])
  }, [activeProject?.path, refreshTree])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  async function toggleNode(node: TreeNode) {
    if (!node.isDir) {
      try {
        const content = await readFile(node.path)
        openFile({ id: node.path, path: node.path, name: node.name, language: node.name.split('.').pop() || '', content, isDirty: false })
      } catch (err) {
        console.error('Error reading file:', err)
      }
      return
    }

    if (node.expanded) {
      setRoot(prev => setExpanded(prev, node.path, false))
      return
    }

    setRoot(prev => setExpanded(prev, node.path, true))
    const children = await loadTree(node.path)
    setRoot(prev => setChildren(prev, node.path, children))
  }

  function setExpanded(nodes: TreeNode[], path: string, expanded: boolean): TreeNode[] {
    return nodes.map(n => {
      if (n.path === path) return { ...n, expanded }
      if (n.children) return { ...n, children: setExpanded(n.children, path, expanded) }
      return n
    })
  }

  function setChildren(nodes: TreeNode[], path: string, children: TreeNode[]): TreeNode[] {
    return nodes.map(n => {
      if (n.path === path) return { ...n, children, expanded: true }
      if (n.children) return { ...n, children: setChildren(n.children, path, children) }
      return n
    })
  }

  function handleContextMenu(e: React.MouseEvent, node: TreeNode | null) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, target: node })
  }

  async function handleNewFile() {
    if (!creating || !newName.trim()) return
    const path = `${creating.parentPath}/${newName.trim()}`
    await writeFile(path, '')
    setCreating(null)
    setNewName('')
    refreshTree()
  }

  async function handleNewFolder() {
    if (!creating || !newName.trim()) return
    const path = `${creating.parentPath}/${newName.trim()}`
    await createDirectory(path)
    setCreating(null)
    setNewName('')
    refreshTree()
  }

  function renderNode(node: TreeNode, depth: number) {
    const Icon = getFileIcon(node.name, node.isDir)

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded hover:bg-zinc-800/50 group',
            'text-zinc-400 hover:text-zinc-200'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggleNode(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.isDir ? (
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {node.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Icon className={cn('w-4 h-4 shrink-0', node.isDir ? 'text-amber-400' : 'text-blue-400')} />
          <span className="truncate">{node.name}</span>
        </div>

        {node.isDir && node.expanded && node.children && (
          <>
            {creating && creating.parentPath === node.path && (
              <div
                className="flex items-center gap-1 px-2 py-1"
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                {creating.type === 'folder' ? <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> : <FilePlus className="w-3.5 h-3.5 text-blue-400" />}
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') creating.type === 'folder' ? handleNewFolder() : handleNewFile()
                    if (e.key === 'Escape') { setCreating(null); setNewName('') }
                  }}
                  onBlur={() => { setCreating(null); setNewName('') }}
                  className="flex-1 bg-zinc-800 text-zinc-100 text-xs px-1.5 py-0.5 rounded outline-none border border-zinc-600"
                  placeholder={`Nome do ${creating.type === 'folder' ? 'diretório' : 'arquivo'}...`}
                  autoFocus
                />
              </div>
            )}
            {node.children.map(child => renderNode(child, depth + 1))}
          </>
        )}
      </div>
    )
  }

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-zinc-600">Selecione um projeto para explorar</p>
      </div>
    )
  }

  const currentDir = activeProject.path || '/'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-400 truncate">{activeProject.name}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => { setCreating({ parentPath: currentDir, type: 'file' }) }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            title="Novo arquivo"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setCreating({ parentPath: currentDir, type: 'folder' }) }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            title="Nova pasta"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={refreshTree}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {creating && creating.parentPath === currentDir && (
          <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: '8px' }}>
            {creating.type === 'folder' ? <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> : <FilePlus className="w-3.5 h-3.5 text-blue-400" />}
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') creating.type === 'folder' ? handleNewFolder() : handleNewFile()
                if (e.key === 'Escape') { setCreating(null); setNewName('') }
              }}
              onBlur={() => { setCreating(null); setNewName('') }}
              className="flex-1 bg-zinc-800 text-zinc-100 text-xs px-1.5 py-0.5 rounded outline-none border border-zinc-600"
              placeholder={`Nome do ${creating.type === 'folder' ? 'diretório' : 'arquivo'}...`}
              autoFocus
            />
          </div>
        )}
        {root.map(node => renderNode(node, 0))}
        {root.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">Pasta vazia</p>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.target?.isDir && (
            <>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  setCreating({ parentPath: contextMenu.target!.path, type: 'file' })
                  setContextMenu(null)
                }}
              >
                <FilePlus className="w-3.5 h-3.5" /> Novo arquivo
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  setCreating({ parentPath: contextMenu.target!.path, type: 'folder' })
                  setContextMenu(null)
                }}
              >
                <FolderPlus className="w-3.5 h-3.5" /> Nova pasta
              </button>
              <div className="border-t border-zinc-800 my-1" />
            </>
          )}
          {contextMenu.target && (
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-800"
              onClick={async () => {
                await deleteFile(contextMenu.target!.path)
                setContextMenu(null)
                refreshTree()
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          )}
        </div>
      )}
    </div>
  )
}
