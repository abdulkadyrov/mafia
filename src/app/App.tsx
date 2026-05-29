import React from 'react'
import { defaultRoomSettings } from '../game/defaults'
import { normalizeRoomCode } from '../network/RoomService'
import { Lobby } from '../pages/Lobby'
import { Room } from '../pages/Room'
import { createAppPath, createHashAppPath, getPathWithoutBase } from '../shared/routing/basePath'
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
      playerName: string
      joinPeerId?: string
    }

export const App: React.FC = () => {
  const [route, setRoute] = React.useState<RouteState>(() => {
    const parsedRoute = getBrowserRoute()
    const pathMatch = parsedRoute.path.match(/\/room\/([^/?]+)/)
    const params = new URLSearchParams(parsedRoute.search)
    const peer = params.get('peer') ?? undefined

    if (pathMatch) {
      const storedName = window.localStorage.getItem('mafia-player-name')
      const playerName = storedName ? safelyParseStoredName(storedName) : ''

      return {
        name: 'room',
        roomCode: pathMatch[1],
        settings: defaultRoomSettings,
        developerMode: false,
        playerName,
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
          onCreateRoom={(roomCode, settings, developerMode, playerName) => {
            history.replaceState(null, '', createHashAppPath(`/room/${roomCode}`))
            setRoute({
              name: 'room',
              roomCode,
              settings,
              developerMode,
              playerName
            })
          }}
          onJoinRoom={(roomCode, playerName) => {
            const normalizedRoomCode = normalizeRoomCode(roomCode)
            history.replaceState(null, '', createHashAppPath(`/room/${normalizedRoomCode}`))
            setRoute({
              name: 'room',
              roomCode: normalizedRoomCode,
              settings: defaultRoomSettings,
              developerMode: false,
              playerName,
              joinPeerId: normalizedRoomCode
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
          playerName={route.playerName}
          joinPeerId={route.joinPeerId}
        />
      )}
    </div>
  )
}

function getBrowserRoute(): { path: string; search: string } {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : ''

  if (hash) {
    const [path, search = ''] = hash.split('?')

    return {
      path,
      search
    }
  }

  return {
    path: getPathWithoutBase(location.pathname),
    search: location.search.startsWith('?') ? location.search.slice(1) : location.search
  }
}

function safelyParseStoredName(storedName: string): string {
  try {
    return JSON.parse(storedName) as string
  } catch {
    return ''
  }
}
