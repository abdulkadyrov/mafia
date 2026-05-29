import { Peer, DataConnection } from 'peerjs'

export type PeerEvent = {
  type: string
  payload?: any
}

export class PeerService {
  private peer: Peer | null = null
  private connections: Map<string, DataConnection> = new Map()
  private _openPromise: Promise<string> | null = null
  private _openResolve: ((id: string) => void) | null = null
  private _openReject: ((error: Error) => void) | null = null
  private _dataHandlers: Array<(peerId: string, data: any) => void> = []
  private _errorHandlers: Array<(error: Error) => void> = []

  constructor(private id?: string) {}

  init() {
    this.peer = this.id ? new Peer(this.id) : new Peer()
    this._openPromise = new Promise((resolve, reject) => {
      this._openResolve = resolve
      this._openReject = reject
    })
    this.peer.on('open', (id) => {
      console.log('Peer open', id)
      this._openResolve?.(id)
    })
    this.peer.on('error', (error) => {
      console.error('Peer error', error)
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      this._openReject?.(normalizedError)
      this._errorHandlers.forEach((handler) => handler(normalizedError))
    })
    this.peer.on('connection', (conn) => {
      console.log('Incoming connection from', conn.peer)
      this.setupConnection(conn)
    })
  }

  connectTo(peerId: string) {
    if (!this.peer) throw new Error('Peer not initialized')
    const conn = this.peer.connect(peerId)
    this.setupConnection(conn)
    return conn
  }

  private setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn)
    conn.on('data', (data) => {
      try {
        this._dataHandlers.forEach((h) => h(conn.peer, data))
      } catch (err) {
        console.error('data handler error', err)
      }
    })
    conn.on('error', (error) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      this._errorHandlers.forEach((handler) => handler(normalizedError))
    })
    conn.on('close', () => this.connections.delete(conn.peer))
  }

  broadcast(event: PeerEvent) {
    for (const conn of this.connections.values()) {
      conn.send(event)
    }
  }

  sendTo(peerId: string, event: PeerEvent) {
    const conn = this.connections.get(peerId)
    if (!conn) throw new Error('connection not found: ' + peerId)
    conn.send(event)
  }

  onData(cb: (peerId: string, data: any) => void) {
    this._dataHandlers.push(cb)
    return () => {
      const idx = this._dataHandlers.indexOf(cb)
      if (idx >= 0) this._dataHandlers.splice(idx, 1)
    }
  }

  onError(cb: (error: Error) => void) {
    this._errorHandlers.push(cb)
    return () => {
      const idx = this._errorHandlers.indexOf(cb)
      if (idx >= 0) this._errorHandlers.splice(idx, 1)
    }
  }

  getId() {
    return this.peer?.id
  }

  async waitForOpen(): Promise<string> {
    if (this._openPromise) return this._openPromise
    if (this.peer && this.peer.id) return Promise.resolve(this.peer.id)
    return new Promise((resolve, reject) => {
      this._openResolve = resolve
      this._openReject = reject
      this._openPromise = new Promise((r, j) => {
        this._openResolve = r
        this._openReject = j
      })
    })
  }

  destroy() {
    for (const conn of this.connections.values()) {
      conn.close()
    }
    this.connections.clear()
    this.peer?.destroy()
    this.peer = null
  }
}
