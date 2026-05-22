import { PeerService, PeerEvent } from '../services/peer/PeerService'

export type Snapshot = any

export class HostNetwork {
  private peerService: PeerService

  constructor(
    public roomCode: string,
    private getSnapshot: () => Snapshot,
    private onClientAction: (peerId: string, action: any) => void
  ) {
    this.peerService = new PeerService()
  }

  start() {
    this.peerService.init()
    // forward messages from peers
    this.peerService.onData((peerId, data) => {
      if (!data || !data.type) return
      if (data.type === 'requestSnapshot') {
        const snapshot = this.getSnapshot()
        this.peerService.sendTo(peerId, { type: 'snapshot', payload: snapshot })
        return
      }
      if (data.type === 'action') {
        this.onClientAction(peerId, data.payload)
        return
      }
    })

    return this.peerService.waitForOpen()
  }

  broadcastSnapshot() {
    const snapshot = this.getSnapshot()
    const event: PeerEvent = { type: 'snapshot', payload: snapshot }
    this.peerService.broadcast(event)
  }

  stop() {
    this.peerService.destroy()
  }
}
