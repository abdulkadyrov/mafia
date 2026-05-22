import { Peer, DataConnection } from 'peerjs'

export type PeerEvent = {
  type: string
  payload?: any
}

export class PeerService {
  private peer: Peer | null = null
  private connections: Map<string, DataConnection> = new Map()

  constructor(private id?: string) {}

  init() {
    this.peer = new Peer(this.id)
    this.peer.on('open', (id) => {
      console.log('Peer open', id)
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
      console.debug('data from', conn.peer, data)
    })
    conn.on('close', () => this.connections.delete(conn.peer))
  }

  broadcast(event: PeerEvent) {
    for (const conn of this.connections.values()) {
      conn.send(event)
    }
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
