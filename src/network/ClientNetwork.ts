import { PeerService, PeerEvent } from '../services/peer/PeerService'

export class ClientNetwork {
  private peerService: PeerService

  constructor() {
    this.peerService = new PeerService()
  }

  async join(hostPeerId: string) {
    this.peerService.init()
    this.peerService.connectTo(hostPeerId)
  }

  sendAction(action: PeerEvent) {
    this.peerService.broadcast(action)
  }

  destroy() {
    this.peerService.destroy()
  }
}
