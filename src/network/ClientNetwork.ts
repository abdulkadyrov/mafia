import { PeerService, PeerEvent } from '../services/peer/PeerService'

export class ClientNetwork {
  private peerService: PeerService
  private hostPeerId: string | null = null

  constructor(private onSnapshot?: (snapshot: any) => void) {
    this.peerService = new PeerService()
  }

  async join(hostPeerId: string) {
    this.hostPeerId = hostPeerId
    this.peerService.init()
    const connection = this.peerService.connectTo(hostPeerId)
    // listen for snapshot and other messages
    this.peerService.onData((peerId, data) => {
      if (!data || !data.type) return
      if (data.type === 'snapshot') {
        this.onSnapshot?.(data.payload)
      }
    })

    await new Promise<void>((resolve, reject) => {
      connection.on('open', () => resolve())
      connection.on('error', () => reject(new Error('connection failed')))
      window.setTimeout(() => resolve(), 1200)
    })

    // request initial snapshot
    this.peerService.sendTo(hostPeerId, { type: 'requestSnapshot' })
  }

  sendAction(payload: any) {
    if (!this.hostPeerId) throw new Error('not joined')
    this.peerService.sendTo(this.hostPeerId, { type: 'action', payload })
  }

  destroy() {
    this.peerService.destroy()
  }
}
