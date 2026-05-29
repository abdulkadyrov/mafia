import { PeerService, PeerEvent } from '../services/peer/PeerService'

export class ClientNetwork {
  private peerService: PeerService
  private hostPeerId: string | null = null

  constructor(
    private onSnapshot?: (snapshot: any) => void,
    private onConnectionError?: (message: string) => void
  ) {
    this.peerService = new PeerService()
  }

  async join(hostPeerId: string) {
    this.hostPeerId = hostPeerId
    this.peerService.init()
    await this.peerService.waitForOpen()

    this.peerService.onData((peerId, data) => {
      if (!data || !data.type) return
      if (data.type === 'snapshot') {
        this.onSnapshot?.(data.payload)
      }
    })
    this.peerService.onError((error) => {
      this.onConnectionError?.(error.message)
    })

    const connection = this.peerService.connectTo(hostPeerId)

    await new Promise<void>((resolve, reject) => {
      connection.on('open', () => resolve())
      connection.on('error', () => reject(new Error('Не удалось подключиться к комнате')))
      window.setTimeout(() => reject(new Error('Комната не найдена. Проверьте код и Wi-Fi.')), 8000)
    })

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
