import { useCallback } from 'react'
import { invoke, Channel } from '@tauri-apps/api/core'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore, isCloudModel } from '@/stores/settings.store'
import { useSkillsStore } from '@/stores/skills.store'

export function useStream() {
  const { setIsStreaming, addMessage, appendStreamChunk, clearStream, setAgentRunning, addTokens } = useChatStore()

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
    setAgentRunning(mode === 'agent')

    addMessage({
      id: crypto.randomUUID(),
      conversationId,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    })

    const onEvent = new Channel<{ type: 'chunk' | 'token_usage'; content?: string; total?: number }>()
    let fullContent = ''

    onEvent.onmessage = (event) => {
      if (event.type === 'chunk' && event.content) {
        fullContent += event.content
        appendStreamChunk(event.content)
      } else if (event.type === 'token_usage') {
        addTokens(event.total || 0)
      }
    }

    try {
      const isLocalModel = !isCloudModel(activeModel)

      if (isLocalModel) {
        await invoke('chat_completion', {
          request: { message, mode, model: activeModel, activeSkills },
          onEvent,
        })
      } else {
        await invoke('cloud_chat_completion', {
          request: { message, mode, model: activeModel, activeSkills },
          onEvent,
        })
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
    }
  }, [setIsStreaming, addMessage, appendStreamChunk, clearStream, setAgentRunning, addTokens])

  const cancel = useCallback(() => {
    invoke('cancel_chat')
  }, [])

  return { sendMessage, cancel }
}
