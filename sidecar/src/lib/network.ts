const CHECK_URLS = [
  'https://1.1.1.1',
  'https://8.8.8.8',
  'https://google.com',
]

export interface NetworkStatus {
  online: boolean
  latency: number | null
  error: string | null
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  for (const url of CHECK_URLS) {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 5000)

      await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      })
      clearTimeout(id)

      return {
        online: true,
        latency: Date.now() - start,
        error: null,
      }
    } catch {
      // try next URL
    }
  }

  return {
    online: false,
    latency: null,
    error: 'No internet connection detected',
  }
}
