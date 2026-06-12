import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { api } from '@/lib/api'

export type SidecarStatus = 'connecting' | 'online' | 'offline' | 'starting'

const MAX_RETRIES = 30
const RETRY_INTERVAL = 1000

export function useSidecarStatus() {
  const [status, setStatus] = useState<SidecarStatus>('connecting')
  const [retryCount, setRetryCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkAndStart = useCallback(async () => {
    try {
      await api.health()
      setStatus('online')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return true
    } catch {
      return false
    }
  }, [])

  const startSidecar = useCallback(async () => {
    try {
      await invoke('start_sidecar')
    } catch {
      // fallback: assume sidecar will be started externally
    }
  }, [])

  useEffect(() => {
    let attempts = 0

    const poll = async () => {
      const ok = await checkAndStart()
      if (ok) return

      attempts++
      setRetryCount(attempts)

      if (attempts === 1) {
        setStatus('starting')
        await startSidecar()
        // wait a bit before next attempt
        return
      }

      if (attempts >= MAX_RETRIES) {
        setStatus('offline')
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return
      }

      setStatus('connecting')
    }

    // Immediate first check
    poll()

    intervalRef.current = setInterval(poll, RETRY_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [checkAndStart, startSidecar])

  const retry = useCallback(() => {
    setStatus('connecting')
    setRetryCount(0)

    const poll = async () => {
      const ok = await checkAndStart()
      if (ok) return

      setRetryCount((c) => c + 1)
      setStatus('starting')
      await startSidecar()
    }

    poll()
  }, [checkAndStart, startSidecar])

  return { status, retryCount, retry }
}
