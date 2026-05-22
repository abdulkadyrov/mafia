import React from 'react'
import { defaultRoomSettings } from '../game/defaults'
import { Lobby } from '../pages/Lobby'
import { Room } from '../pages/Room'
import { createAppPath, getPathWithoutBase } from '../shared/routing/basePath'
import { RoomSettings } from '../types/game'

type RouteState =
  | {
      name: 'lobby'
    }
  | {
      name: 'room'
      roomCode: string
      settings: RoomSettings
      developerMode: boolean
      joinPeerId?: string
    }

export const App: React.FC = () => {
  const [route, setRoute] = React.useState<RouteState>(() => {
    const appPath = getPathWithoutBase(location.pathname)
    const pathMatch = appPath.match(/\/room\/([^/?]+)/)
    const params = new URLSearchParams(location.search)
    const peer = params.get('peer') ?? undefined

    if (pathMatch) {
      return {
        name: 'room',
        roomCode: pathMatch[1],
        settings: defaultRoomSettings,
        developerMode: false,
        joinPeerId: peer
      }
    }

    return {
      name: 'lobby'
    }
  })

  return (
    <div className="min-h-screen bg-background text-text">
      {route.name === 'lobby' ? (
        <Lobby
          onCreateRoom={(roomCode, settings, developerMode) => {
            history.replaceState(null, '', createAppPath(`/room/${roomCode}`))
            setRoute({
              name: 'room',
              roomCode,
              settings,
              developerMode
            })
          }}
          onJoinRoom={(roomCode) => {
            history.replaceState(null, '', createAppPath(`/room/${roomCode}`))
            setRoute({
              name: 'room',
              roomCode,
              settings: defaultRoomSettings,
              developerMode: false
            })
          }}
        />
      ) : (
        <Room
          onLeave={() => {
            history.replaceState(null, '', createAppPath('/'))
            setRoute({ name: 'lobby' })
          }}
          roomCode={route.roomCode}
          settings={route.settings}
          developerMode={route.developerMode}
          joinPeerId={route.joinPeerId}
        />
      )}
    </div>
  )
}
