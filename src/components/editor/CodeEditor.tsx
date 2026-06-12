import { useCallback } from 'react'
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react'
import { useProjectStore } from '@/stores/project.store'
import { writeFile } from '@/lib/filesystem'
import { LANGUAGES } from '@/types'

const THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'constant', foreground: '4FC1FF' },
  ],
  colors: {
    'editor.background': '#09090b',
    'editor.foreground': '#e4e4e7',
    'editor.lineHighlightBackground': '#18181b',
    'editor.selectionBackground': '#264f78',
    'editorCursor.foreground': '#e4e4e7',
    'editorLineNumber.foreground': '#52525b',
    'editorLineNumber.activeForeground': '#a1a1aa',
  },
}

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return LANGUAGES[ext] || 'plaintext'
}

export function CodeEditor() {
  const { openFiles, activeFileId, updateFileContent } = useProjectStore()

  const activeFile = openFiles.find(f => f.id === activeFileId)

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme('aibuilder-dark', THEME)
    monaco.editor.setTheme('aibuilder-dark')
  }, [])

  const handleChange: OnChange = useCallback((value) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile.id, value)
    }
  }, [activeFile, updateFileContent])

  const handleSave = useCallback(async () => {
    if (!activeFile) return
    await writeFile(activeFile.path, activeFile.content)
    useProjectStore.getState().markFileClean(activeFile.id)
  }, [activeFile])

  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-zinc-600">Nenhum arquivo aberto</p>
          <p className="text-xs text-zinc-700">
            Clique em um arquivo no explorador ao lado para começar a editar
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" onKeyDown={(e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }}>
      <Editor
        key={activeFile.id}
        language={getLanguage(activeFile.name)}
        value={activeFile.content}
        onChange={handleChange}
        theme="aibuilder-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          tabSize: 2,
          insertSpaces: true,
          automaticLayout: true,
          padding: { top: 8 },
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          wordWrap: 'off',
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}
