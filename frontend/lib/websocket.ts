import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

class WebSocketManager {
  private socket: Socket | null = null
  private token: string | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  connect(token: string) {
    if (this.socket?.connected) {
      return
    }

    this.token = token
    
    // For FastAPI WebSocket, we need to use native WebSocket
    // Socket.io client won't work with FastAPI WebSockets
    this.connectNative(token)
  }

  private connectNative(token: string) {
    const wsUrl = `${WS_URL.replace('ws://', 'http://').replace('wss://', 'https://')}/ws?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      this.emit('connected', {})
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setTimeout(() => {
        if (this.token) {
          this.connectNative(this.token)
        }
      }, 3000)
    }

    // Store WebSocket in a way we can access it
    ;(this as any).ws = ws
  }

  private handleMessage(data: any) {
    const type = data.type
    const handlers = this.listeners.get(type)
    if (handlers) {
      handlers.forEach((handler) => handler(data.data || data))
    }

    // Also call 'message' handlers
    const messageHandlers = this.listeners.get('message')
    if (messageHandlers) {
      messageHandlers.forEach((handler) => handler(data))
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: any) => void) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(callback)
    }
  }

  emit(event: string, data: any) {
    const ws = (this as any).ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: event, data }))
    }
  }

  disconnect() {
    const ws = (this as any).ws
    if (ws) {
      ws.close()
      ;(this as any).ws = null
    }
    this.token = null
    this.listeners.clear()
  }
}

export const wsManager = new WebSocketManager()
