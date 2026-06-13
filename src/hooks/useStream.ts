import { useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useSkillsStore } from '@/stores/skills.store'

const SIDECAR_URL = 'http://127.0.0.1:3001'

export function useStream() {
  const abortRef = useRef<AbortController | null>(null)
  const { setIsStreaming, addMessage, appendStreamChunk, clearStream, setAgentRunning, addTokens, addAgentEvent, clearAgentEvents } = useChatStore()

  const sendMessage = useCallback(async (message: string, mode: string, conversationId: string, projectId: string) => {
    const activeModel = useSettingsStore.getState().activeModel
    const pinnedSkills = useSkillsStore.getState().pinned
    const allSkills = useSkillsStore.getState().available
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

    addMessage({
      id: crypto.randomUUID(),
      conversationId,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    })

    const abortController = new AbortController()
    abortRef.current = abortController

    let fullContent = ''

    try {
      const response = await fetch(`${SIDECAR_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          projectId,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

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
          if (data === '[DONE]') break

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
        addMessage({
          id: crypto.randomUUID(),
          conversationId,
          role: 'assistant',
          content: fullContent,
          createdAt: new Date().toISOString(),
        })
        clearStream()
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const errMsg = typeof err === 'string' ? err : (err instanceof Error ? err.message : JSON.stringify(err))
      addMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: 'system',
        content: `Erro na conexão: ${errMsg}.`,
        createdAt: new Date().toISOString(),
      })
    } finally {
      setIsStreaming(false)
      setAgentRunning(false)
      abortRef.current = null
    }
  }, [setIsStreaming, addMessage, appendStreamChunk, clearStream, setAgentRunning, addTokens, addAgentEvent, clearAgentEvents])

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  return { sendMessage, cancel }
}
