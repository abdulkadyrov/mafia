import React from 'react'
import { motion } from 'framer-motion'
import { PlayerActionPanel } from '../features/game-actions/PlayerActionPanel'
import {
  addPlayer,
  createInitialSnapshot,
  enterPhase,
  moveToDiscussion,
  moveToNextNight,
  moveToVoting,
  resolveNight,
  resolveVotes,
  seedDemoPlayers,
  startGame,
  submitNightAction,
  submitVote
} from '../game/engine'
import { samplePlayerNames } from '../game/defaults'
import { generateQRCode } from '../network/RoomService'
import { HostNetwork } from '../network/HostNetwork'
import { ClientNetwork } from '../network/ClientNetwork'
import { saveArchivedGame } from '../services/storage/GameArchiveService'
import { PlayerRow } from '../entities/player/PlayerRow'
import { createAppPath } from '../shared/routing/basePath'
import { Button } from '../shared/ui/Button'
import { Panel } from '../shared/ui/Panel'
import { GameOverPanel } from '../widgets/GameOverPanel'
import { LogoMark } from '../widgets/LogoMark'
import { PhasePanel } from '../widgets/PhasePanel'
import { SystemFeed } from '../widgets/SystemFeed'
import { ClientAction, GameSnapshot, RoomSettings, roleLabels } from '../types/game'

type Props = {
  onLeave: () => void
  roomCode: string
  settings: RoomSettings
  developerMode: boolean
  joinPeerId?: string
}

export const Room: React.FC<Props> = ({ onLeave, roomCode, settings, developerMode, joinPeerId }) => {
  const [snapshot, setSnapshot] = React.useState<GameSnapshot>(() => {
    const initialSnapshot = createInitialSnapshot({ roomCode, settings })

    return addPlayer(initialSnapshot, {
      name: 'Хост',
      isHost: true
    })
  })
  const [inviteQr, setInviteQr] = React.useState<string>()
  const [hostPeerId, setHostPeerId] = React.useState<string>()
  const [clientConnected, setClientConnected] = React.useState(false)
  const [selfPlayerId, setSelfPlayerId] = React.useState<string>()
  const hostRef = React.useRef<HostNetwork>()
  const clientRef = React.useRef<ClientNetwork>()
  const snapshotRef = React.useRef(snapshot)
  const isClient = Boolean(joinPeerId)

  React.useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  React.useEffect(() => {
    if (isClient) return undefined

    const host = new HostNetwork(roomCode, () => snapshotRef.current, (_peerId, action: ClientAction) => {
      setSnapshot((currentSnapshot) => applyClientAction(currentSnapshot, action))
    })

    hostRef.current = host
    host.start().then(async (peerId) => {
      setHostPeerId(peerId)
      const inviteUrl = `${location.origin}${createAppPath(`/room/${roomCode}`)}?peer=${encodeURIComponent(peerId)}`
      setInviteQr(await generateQRCode(inviteUrl))
    })

    return () => {
      host.stop()
      hostRef.current = undefined
    }
  }, [isClient, roomCode])

  React.useEffect(() => {
    if (!joinPeerId) return undefined

    const client = new ClientNetwork((remoteSnapshot) => {
      setSnapshot(remoteSnapshot)
    })

    clientRef.current = client
    client
      .join(joinPeerId)
      .then(() => setClientConnected(true))
      .catch(() => setClientConnected(false))

    return () => {
      client.destroy()
      clientRef.current = undefined
    }
  }, [joinPeerId])

  React.useEffect(() => {
    if (!isClient) {
      hostRef.current?.broadcastSnapshot()
    }

    if (snapshot.phase === 'GameOver') {
      saveArchivedGame(snapshot).catch(() => undefined)
    }
  }, [isClient, snapshot])

  const selfPlayer = snapshot.players.find((player) => player.id === selfPlayerId) ?? snapshot.players[0]

  function updateHostSnapshot(updater: (currentSnapshot: GameSnapshot) => GameSnapshot) {
    setSnapshot((currentSnapshot) => updater(currentSnapshot))
  }

  function sendAction(action: ClientAction) {
    if (isClient) {
      clientRef.current?.sendAction(action)
      return
    }

    setSnapshot((currentSnapshot) => applyClientAction(currentSnapshot, action))
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <LogoMark />
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-muted sm:inline">
            {isClient ? (clientConnected ? 'Подключено' : 'Подключение') : 'Хост'}
          </span>
          <Button variant="ghost" onClick={onLeave}>
            Выйти
          </Button>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="grid gap-5 lg:grid-cols-[1fr_380px]"
      >
        <div className="space-y-5">
          <Panel>
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-medium text-muted">Код комнаты</p>
                <h1 className="mt-1 font-mono text-4xl font-black text-text">{roomCode}</h1>
                <p className="mt-2 text-sm text-muted">
                  QR подключает игроков напрямую к PeerJS-хосту. Код можно ввести вручную.
                </p>
              </div>
              {inviteQr ? (
                <img src={inviteQr} alt="QR приглашение" className="h-36 w-36 rounded-xl bg-white p-2" />
              ) : (
                <div className="grid h-36 w-36 place-items-center rounded-xl bg-card text-center text-xs text-muted">
                  QR готовится
                </div>
              )}
            </div>
            {hostPeerId ? <p className="mt-4 break-all text-xs text-muted">Peer: {hostPeerId}</p> : null}
          </Panel>

          {snapshot.phase === 'Lobby' ? (
            <Panel>
              <h2 className="text-lg font-semibold text-text">Лобби</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Добавьте демо-игроков для локальной проверки или подключите телефоны через QR.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Button
                  onClick={() => updateHostSnapshot((currentSnapshot) => seedDemoPlayers(currentSnapshot, samplePlayerNames))}
                  disabled={isClient}
                >
                  Заполнить
                </Button>
                <Button
                  variant="primary"
                  disabled={isClient || snapshot.players.length < 4}
                  onClick={() => updateHostSnapshot(startGame)}
                >
                  Старт
                </Button>
                <Button disabled={isClient} onClick={() => updateHostSnapshot((currentSnapshot) => enterPhase(currentSnapshot, 'Lobby'))}>
                  Синхронизировать
                </Button>
              </div>
            </Panel>
          ) : (
            <PhasePanel
              snapshot={snapshot}
              onResolveNight={() => updateHostSnapshot(resolveNight)}
              onDiscussion={() => updateHostSnapshot(moveToDiscussion)}
              onVoting={() => updateHostSnapshot(moveToVoting)}
              onResolveVotes={() => updateHostSnapshot(resolveVotes)}
              onNextNight={() => updateHostSnapshot(moveToNextNight)}
            />
          )}

          <GameOverPanel snapshot={snapshot} />

          {selfPlayer ? (
            <PlayerActionPanel
              snapshot={snapshot}
              selfPlayer={selfPlayer}
              onNightAction={(type, targetId) => {
                sendAction({
                  type: 'nightAction',
                  action: {
                    actorId: selfPlayer.id,
                    targetId,
                    type
                  }
                })
              }}
              onVote={(vote) => {
                sendAction({
                  type: 'vote',
                  vote
                })
              }}
            />
          ) : null}
        </div>

        <aside className="space-y-5">
          <Panel>
            <h2 className="mb-4 text-lg font-semibold text-text">Игроки</h2>
            <div className="grid gap-2">
              {snapshot.players.map((player) => (
                <div key={player.id} className="relative">
                  <PlayerRow
                    player={player}
                    selected={selfPlayer?.id === player.id}
                    revealRole={developerMode || snapshot.phase === 'GameOver' || player.id === selfPlayer?.id}
                    onClick={() => {
                      setSelfPlayerId(player.id)
                    }}
                  />
                  {developerMode ? (
                    <span className="absolute right-16 top-1/2 -translate-y-1/2 rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-white">
                      {roleLabels[player.role]}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <SystemFeed snapshot={snapshot} selfPlayerId={selfPlayer?.id} />
        </aside>
      </motion.div>
    </main>
  )
}

function applyClientAction(snapshot: GameSnapshot, action: ClientAction): GameSnapshot {
  if (action.type === 'joinRoom') {
    return addPlayer(snapshot, {
      name: action.playerName
    })
  }

  if (action.type === 'nightAction') {
    return submitNightAction(snapshot, action.action)
  }

  if (action.type === 'vote') {
    return submitVote(snapshot, action.vote)
  }

  return snapshot
}
