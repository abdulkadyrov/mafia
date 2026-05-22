import React from 'react'
import { HostNetwork } from '../network/HostNetwork'
import { generateQRCode } from '../network/RoomService'

type Props = {
  onLeave: () => void
  roomCode?: string
}

export const Room: React.FC<Props> = ({ onLeave, roomCode }) => {
  const [inviteQr, setInviteQr] = React.useState<string | null>(null)
  const hostRef = React.useRef<HostNetwork | null>(null)

  React.useEffect(() => {
    // only host when roomCode exists
    if (!roomCode) return
    const host = new HostNetwork(roomCode)
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
            <li>Тимур — жив</li>
            <li>Лёха — жив</li>
          </ul>
        </div>

        {inviteQr && (
          <div className="bg-[#111827] rounded-xl p-6 shadow-md mt-4">
            <h3 className="mb-2">Приглашение</h3>
            <img src={inviteQr} alt="invite-qr" className="w-40 h-40" />
          </div>
        )}
      </section>
    </main>
  )
}
