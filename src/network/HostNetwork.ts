import { PeerService, PeerEvent } from '../services/peer/PeerService'

export type Snapshot = any

export class HostNetwork {
  private peerService: PeerService

  constructor(public roomCode: string) {
    this.peerService = new PeerService()
  }

  start() {
    this.peerService.init()
    // listen for incoming messages and respond accordingly
    return this.peerService.waitForOpen()
  }

  broadcastSnapshot(snapshot: Snapshot) {
    const event: PeerEvent = { type: 'snapshot', payload: snapshot }
    this.peerService.broadcast(event)
  }

  stop() {
    this.peerService.destroy()
  }
}
