import React from 'react'
import { Lobby } from '../pages/Lobby'
import { Room } from '../pages/Room'

export const App: React.FC = () => {
  const [route, setRoute] = React.useState<'lobby' | 'room'>('lobby')
  const [roomCode, setRoomCode] = React.useState<string | undefined>(undefined)
  const [joinPeer, setJoinPeer] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    // Handle direct links like /room/ABCD-92?peer=PEERID
    const path = location.pathname
    const match = path.match(/\/room\/(.+)/)
    const params = new URLSearchParams(location.search)
    const peer = params.get('peer') || undefined
    if (match) {
      setRoomCode(match[1])
      setJoinPeer(peer)
      setRoute('room')
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F9FAFB] font-sans">
      {route === 'lobby' ? (
        <Lobby
          onCreateRoom={(code) => {
            setRoomCode(code)
            setRoute('room')
          }}
        />
      ) : (
        <Room onLeave={() => setRoute('lobby')} roomCode={roomCode} joinPeerId={joinPeer} />
      )}
    </div>
  )
}
