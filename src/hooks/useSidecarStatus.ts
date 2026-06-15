import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { api } from '@/lib/api'

export type SidecarStatus = 'connecting' | 'online' | 'offline' | 'starting'

const MAX_RETRIES = 45
const RETRY_INTERVAL = 1000

export function useSidecarStatus() {
  const [status, setStatus] = useState<SidecarStatus>('connecting')
  const [retryCount, setRetryCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedOnce = useRef(false)

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

  const stopSidecar = useCallback(async () => {
    try {
      await invoke('stop_sidecar')
    } catch {
      // ignore
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
    let initialDelay = false

    const poll = async () => {
      const ok = await checkAndStart()
      if (ok) return

      attempts++
      setRetryCount(attempts)

      if (!initialDelay) {
        initialDelay = true
        // Give the auto-start from lib.rs a head start before we try
        return
      }

      if (!startedOnce.current) {
        startedOnce.current = true
        setStatus('starting')
        await startSidecar()
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

    // Wait 2s before first poll to let auto-start in lib.rs initialize
    const initialTimer = setTimeout(() => {
      poll()
      intervalRef.current = setInterval(poll, RETRY_INTERVAL)
    }, 2000)

    return () => {
      clearTimeout(initialTimer)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [checkAndStart, startSidecar])

  const retry = useCallback(async () => {
    setStatus('starting')
    setRetryCount(0)
    startedOnce.current = false

    // Kill any stale sidecar before restarting
    await stopSidecar()
    // Small delay for port to release
    await new Promise(r => setTimeout(r, 500))
    await startSidecar()

    // Start polling
    let attempts = 0
    const iv = setInterval(async () => {
      const ok = await checkAndStart()
      if (ok) {
        clearInterval(iv)
        return
      }
      attempts++
      setRetryCount(attempts)
      if (attempts >= MAX_RETRIES) {
        setStatus('offline')
        clearInterval(iv)
      }
    }, RETRY_INTERVAL)
  }, [checkAndStart, startSidecar, stopSidecar])

  return { status, retryCount, retry }
}
