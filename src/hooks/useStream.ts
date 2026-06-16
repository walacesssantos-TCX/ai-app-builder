import { useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSkillsStore } from '@/stores/skills.store'
import type { FileAttachment } from '@/types'

const SIDECAR_URL = 'http://127.0.0.1:3001'
const OUTPUT_DIR = 'C:\\Users\\walace\\Music\\Fluxcodex'

function genId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${performance.now().toString(36).slice(2, 6)}`
  }
}

const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma'])

function hasAudioFiles(files: FileAttachment[]): boolean {
  return files.some(f => {
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    return AUDIO_EXTENSIONS.has(ext)
  })
}

async function saveOutputFile(filename: string, content: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const baseName = filename.replace(/\.[^.]+$/, '')
    const outPath = `${OUTPUT_DIR}\\${baseName}_transcription.txt`
    await invoke('write_file', { path: outPath, content })
    console.log(`[useStream] Saved transcription to ${outPath}`)
  } catch {
    // Tauri not available
  }
}

export function useStream() {
  const abortRef = useRef<AbortController | null>(null)
  const cancelRef = useRef(false)
  const { setIsStreaming, addMessage, appendStreamChunk, clearStream, setAgentRunning, addTokens, addAgentEvent, clearAgentEvents, persistConversation, persistMessage } = useChatStore()

  const sendMessage = useCallback(async (message: string, mode: string, conversationId: string, _projectId: string, files: FileAttachment[] = []) => {
    const activeModel = useSettingsStore.getState().activeModel
    const pinnedSkills = useSkillsStore.getState().pinned
    const allSkills = useSkillsStore.getState().available

    let fullContent = ''
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const abortController = new AbortController()
    abortRef.current = abortController
    cancelRef.current = false

    try {
      const activeSkills = allSkills.filter(s => pinnedSkills.includes(s.name)).map(s => ({
        name: s.name,
        description: s.description,
        content: s.content,
        priority: s.priority,
        tools: s.tools || [],
      }))

      setIsStreaming(true)
      clearStream()
      clearAgentEvents()
      setAgentRunning(mode === 'agent')

      // Persist conversation to backend
      persistConversation(conversationId)

      const userMsgId = genId()
      const userMsg = {
        id: userMsgId,
        conversationId,
        role: 'user' as const,
        content: message,
        attachments: files.length > 0 ? files : undefined,
        createdAt: new Date().toISOString(),
      }
      addMessage(userMsg)
      persistMessage(conversationId, userMsg)

      // Auto-timeout: abort after 60s so "Failed to fetch" vira mensagem amigável
      timeoutId = setTimeout(() => {
        abortController.abort()
      }, 60_000)

      const body: Record<string, unknown> = {
        message,
        mode: mode === 'agent' ? 'agent' : mode,
        model: activeModel,
        activeSkills: pinnedSkills.length > 0 ? activeSkills : [],
        availableSkills: allSkills.map(s => ({
          name: s.name,
          description: s.description,
          priority: s.priority,
        })),
        pinnedSkills,
        projectId: '',
        conversationId,
      }
      if (files.length > 0) {
        body.files = files.map(f => ({ name: f.name, mimeType: f.mimeType, size: f.size, content: f.content }))
      }

      const response = await fetch(`${SIDECAR_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      readLoop:
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') break readLoop

          try {
            const event = JSON.parse(data)

            switch (event.type) {
              case 'chunk':
                fullContent += event.content
                appendStreamChunk(event.content)
                break
              case 'token_usage':
                addTokens(event.total || 0)
                break
              case 'message':
                if (event.content) {
                  fullContent = event.content
                }
                break
              case 'thinking':
              case 'tool_call':
              case 'tool_result':
                addAgentEvent(event)
                break
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      if (fullContent) {
        const assistantMsg = {
          id: genId(),
          conversationId,
          role: 'assistant' as const,
          content: fullContent,
          createdAt: new Date().toISOString(),
        }
        addMessage(assistantMsg)
        persistMessage(conversationId, assistantMsg)
        clearStream()

        // Save processed file to Music/Fluxcodex when audio was attached
        if (hasAudioFiles(files)) {
          saveOutputFile(files[0].name, fullContent)
        }
      }
    } catch (err: unknown) {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (cancelRef.current) return
        const sysMsg = {
          id: genId(),
          conversationId,
          role: 'system' as const,
          content: 'Erro na conexão: A requisição excedeu o tempo limite de 60 segundos. Verifique se o servidor Groq está respondendo.',
          createdAt: new Date().toISOString(),
        }
        addMessage(sysMsg)
        persistMessage(conversationId, sysMsg)
        return
      }
      const errMsg = typeof err === 'string' ? err : (err instanceof Error ? err.message : JSON.stringify(err))
      const sysMsg = {
        id: genId(),
        conversationId,
        role: 'system' as const,
        content: `Erro na conexão: ${errMsg}.`,
        createdAt: new Date().toISOString(),
      }
      addMessage(sysMsg)
      persistMessage(conversationId, sysMsg)
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      setIsStreaming(false)
      setAgentRunning(false)
      abortRef.current = null
    }
  }, [setIsStreaming, addMessage, appendStreamChunk, clearStream, setAgentRunning, addTokens, addAgentEvent, clearAgentEvents, persistConversation, persistMessage])

  const cancel = useCallback(() => {
    cancelRef.current = true
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  return { sendMessage, cancel }
}
