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
    this.peerService.connectTo(hostPeerId)
    // listen for snapshot and other messages
    this.peerService.onData((peerId, data) => {
      if (!data || !data.type) return
      if (data.type === 'snapshot') {
        this.onSnapshot?.(data.payload)
      }
    })

    // request initial snapshot
    setTimeout(() => {
      try {
        this.peerService.sendTo(hostPeerId, { type: 'requestSnapshot' })
      } catch (e) {
        // ignore if not yet connected
      }
    }, 500)
  }

  sendAction(payload: any) {
    if (!this.hostPeerId) throw new Error('not joined')
    this.peerService.sendTo(this.hostPeerId, { type: 'action', payload })
  }

  destroy() {
    this.peerService.destroy()
  }
}
