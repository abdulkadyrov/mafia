import React from 'react'
import { HostNetwork } from '../network/HostNetwork'
import { generateQRCode } from '../network/RoomService'
import { ClientNetwork } from '../network/ClientNetwork'

type Props = {
  onLeave: () => void
  roomCode?: string
  joinPeerId?: string | undefined
}

export const Room: React.FC<Props> = ({ onLeave, roomCode, joinPeerId }) => {
  const [inviteQr, setInviteQr] = React.useState<string | null>(null)
  const hostRef = React.useRef<HostNetwork | null>(null)
  const clientRef = React.useRef<ClientNetwork | null>(null)
  const [joinedAsClient, setJoinedAsClient] = React.useState(false)
  const [remoteSnapshot, setRemoteSnapshot] = React.useState<any | null>(null)

  React.useEffect(() => {
    // host flow
    if (!roomCode) return
    const host = new HostNetwork(roomCode, () => ({ room: roomCode, players: [] }), (peerId, action) => {
      console.log('action from', peerId, action)
      // host should apply action to engine (to be implemented)
    })
    hostRef.current = host
    host.start().then(async (peerId) => {
      const inviteUrl = `${location.origin}/room/${roomCode}?peer=${encodeURIComponent(peerId)}`
      const data = await generateQRCode(inviteUrl)
      setInviteQr(data)
    })

    return () => {
      host.stop()
    }
  }, [roomCode])

  React.useEffect(() => {
    // client auto-join flow when joinPeerId present
    if (!joinPeerId) return
    const client = new ClientNetwork((snapshot) => {
      setRemoteSnapshot(snapshot)
    })
    clientRef.current = client
    client.join(joinPeerId).then(() => setJoinedAsClient(true)).catch(() => {})
    return () => {
      client.destroy()
    }
  }, [joinPeerId])

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Комната</h1>
        <button className="text-sm text-[#9CA3AF]" onClick={onLeave}>
          Выйти
        </button>
      </header>

      <section className="space-y-4">
        <div className="bg-[#111827] rounded-xl p-6 shadow-md">
          <h2 className="text-lg">Код комнаты</h2>
          <div className="mt-3 text-2xl font-mono">{roomCode ?? '—'}</div>
        </div>

        <div className="bg-[#111827] rounded-xl p-6 shadow-md">
          <h3 className="mb-2">Игроки</h3>
          <ul className="space-y-2 text-sm text-[#9CA3AF]">
            {remoteSnapshot?.players?.length
              ? remoteSnapshot.players.map((p: any) => (
                  <li key={p.id}>{p.name} — {p.alive ? 'жив' : 'мертв'}</li>
                ))
              : (
                <>
                  <li>Тимур — жив</li>
                  <li>Лёха — жив</li>
                </>
              )}
          </ul>
        </div>

        {inviteQr && (
          <div className="bg-[#111827] rounded-xl p-6 shadow-md mt-4">
            <h3 className="mb-2">Приглашение</h3>
            <img src={inviteQr} alt="invite-qr" className="w-40 h-40" />
          </div>
        )}

        {joinPeerId && (
          <div className="bg-[#111827] rounded-xl p-6 shadow-md mt-4">
            <h3 className="mb-2">Статус подключения</h3>
            <div>{joinedAsClient ? 'Подключено к хосту' : 'Подключение...'}</div>
          </div>
        )}
      </section>
    </main>
  )
}
