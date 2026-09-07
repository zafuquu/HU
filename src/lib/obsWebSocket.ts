/**
 * OBS WebSocket Integration Client (#24)
 * Connects to OBS Studio obs-websocket v5 protocol (ws://localhost:4455)
 * Allows auto scene switching based on Valorant game phase (Buy Phase -> Buy Scene, Live -> Ingame, etc.)
 */

export interface ObsConfig {
  host?: string
  port?: number
  password?: string
  autoSwitch?: boolean
  sceneMap?: Record<string, string> // e.g. { 'ingame-hud': 'In Game', 'buy-round': 'Shopping', 'post-game': 'Post Match' }
}

export class ObsWebSocketClient {
  private ws: WebSocket | null = null
  private config: ObsConfig
  private isConnected: boolean = false
  private onStatusChange?: (connected: boolean) => void

  constructor(config: ObsConfig = {}, onStatusChange?: (connected: boolean) => void) {
    this.config = {
      host: 'localhost',
      port: 4455,
      autoSwitch: false,
      sceneMap: {
        'ingame-hud': 'In Game',
        'buy-round': 'Buy Phase',
        'agent-select': 'Agent Select',
        'post-game': 'Post Game',
        'map-ban': 'Map Veto',
      },
      ...config,
    }
    this.onStatusChange = onStatusChange
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      const url = `ws://${this.config.host || 'localhost'}:${this.config.port || 4455}`
      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          this.isConnected = true
          this.onStatusChange?.(true)
          resolve(true)
        }

        this.ws.onerror = () => {
          this.isConnected = false
          this.onStatusChange?.(false)
          resolve(false)
        }

        this.ws.onclose = () => {
          this.isConnected = false
          this.onStatusChange?.(false)
        }
      } catch {
        this.isConnected = false
        this.onStatusChange?.(false)
        resolve(false)
      }
    })
  }

  public disconnect() {
    this.ws?.close()
    this.ws = null
    this.isConnected = false
    this.onStatusChange?.(false)
  }

  public getConnected(): boolean {
    return this.isConnected
  }

  /** Trigger OBS scene switch based on overlay scene */
  public switchScene(sceneKey: string) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const obsSceneName = this.config.sceneMap?.[sceneKey] || sceneKey

    // obs-websocket v5 SetCurrentProgramScene request
    const payload = {
      op: 6, // Request
      d: {
        requestType: 'SetCurrentProgramScene',
        requestId: `req_${Date.now()}`,
        requestData: {
          sceneName: obsSceneName,
        },
      },
    }

    try {
      this.ws.send(JSON.stringify(payload))
    } catch {
      // ignore websocket send errors
    }
  }
}
