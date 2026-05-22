import React from 'react'
import { Lobby } from '../pages/Lobby'
import { Room } from '../pages/Room'

export const App: React.FC = () => {
  const [route, setRoute] = React.useState<'lobby' | 'room'>('lobby')

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F9FAFB] font-sans">
      {route === 'lobby' ? (
        <Lobby onCreateRoom={() => setRoute('room')} />
      ) : (
        <Room onLeave={() => setRoute('lobby')} />
      )}
    </div>
  )
}
