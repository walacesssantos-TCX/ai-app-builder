declare module 'ws' {
  interface WebSocket {
    on(event: 'open', handler: () => void): void
    on(event: 'message', handler: (data: Buffer | string) => void): void
    on(event: 'close', handler: () => void): void
    on(event: 'error', handler: (err: Error) => void): void
    send(data: string): void
    close(): void
  }
  interface WebSocketConstructor {
    new (url: string): WebSocket
  }
  const WebSocket: WebSocketConstructor
  export default WebSocket
}
