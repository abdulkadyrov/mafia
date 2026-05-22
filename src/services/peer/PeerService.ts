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
  private _dataHandlers: Array<(peerId: string, data: any) => void> = []

  constructor(private id?: string) {}

  init() {
    this.peer = new Peer(this.id)
    this._openPromise = new Promise((resolve) => {
      this._openResolve = resolve
    })
    this.peer.on('open', (id) => {
      console.log('Peer open', id)
      this._openResolve?.(id)
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

  getId() {
    return this.peer?.id
  }

  async waitForOpen(): Promise<string> {
    if (this._openPromise) return this._openPromise
    if (this.peer && this.peer.id) return Promise.resolve(this.peer.id)
    return new Promise((resolve) => {
      this._openResolve = resolve
      this._openPromise = new Promise((r) => (this._openResolve = r))
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
