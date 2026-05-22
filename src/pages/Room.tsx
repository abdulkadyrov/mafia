import React from 'react'
import { motion } from 'framer-motion'
import { PlayerActionPanel } from '../features/game-actions/PlayerActionPanel'
import {
  addPlayer,
  createInitialSnapshot,
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
import { createId } from '../game/id'
import { samplePlayerNames } from '../game/defaults'
import { useCountdown } from '../hooks/useCountdown'
import { ClientNetwork } from '../network/ClientNetwork'
import { HostNetwork } from '../network/HostNetwork'
import { generateQRCode } from '../network/RoomService'
import { saveArchivedGame } from '../services/storage/GameArchiveService'
import { createHashAppPath } from '../shared/routing/basePath'
import { Button } from '../shared/ui/Button'
import { ClientAction, GamePhase, GameSnapshot, PlayerId, RoomSettings, phaseLabels } from '../types/game'

type Props = {
  onLeave: () => void
  roomCode: string
  settings: RoomSettings
  developerMode: boolean
  playerName: string
  joinPeerId?: string
}

export const Room: React.FC<Props> = ({ onLeave, roomCode, settings, developerMode, playerName, joinPeerId }) => {
  const isClient = Boolean(joinPeerId)
  const localPlayerId = React.useMemo(() => createId('player'), [])
  const [displayName, setDisplayName] = React.useState(playerName)
  const [snapshot, setSnapshot] = React.useState<GameSnapshot>(() => {
    const initialSnapshot = createInitialSnapshot({ roomCode, settings })

    if (isClient) return initialSnapshot

    return addPlayer(initialSnapshot, {
      id: localPlayerId,
      name: playerName || 'Хост',
      isHost: true
    })
  })
  const [inviteQr, setInviteQr] = React.useState<string>()
  const [clientConnected, setClientConnected] = React.useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<PlayerId>(localPlayerId)
  const hostRef = React.useRef<HostNetwork>()
  const clientRef = React.useRef<ClientNetwork>()
  const snapshotRef = React.useRef(snapshot)
  const secondsLeft = useCountdown(snapshot.phaseEndsAt)
  const selfPlayer = snapshot.players.find((player) => player.id === localPlayerId) ?? snapshot.players[0]

  React.useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  React.useEffect(() => {
    if (isClient || !displayName.trim()) return undefined

    const host = new HostNetwork(roomCode, () => snapshotRef.current, (_peerId, action: ClientAction) => {
      setSnapshot((currentSnapshot) => applyClientAction(currentSnapshot, action))
    })

    hostRef.current = host
    host.start().then(async (peerId) => {
      const inviteUrl = `${location.origin}${createHashAppPath(`/room/${roomCode}`)}?peer=${encodeURIComponent(peerId)}`
      setInviteQr(await generateQRCode(inviteUrl))
    })

    return () => {
      host.stop()
      hostRef.current = undefined
    }
  }, [displayName, isClient, roomCode])

  React.useEffect(() => {
    if (!joinPeerId || !displayName.trim()) return undefined

    const client = new ClientNetwork((remoteSnapshot) => {
      setSnapshot(remoteSnapshot)
    })

    clientRef.current = client
    client
      .join(joinPeerId)
      .then(() => {
        setClientConnected(true)
        client.sendAction({
          type: 'joinRoom',
          playerId: localPlayerId,
          playerName: displayName.trim()
        })
      })
      .catch(() => setClientConnected(false))

    return () => {
      client.destroy()
      clientRef.current = undefined
    }
  }, [displayName, joinPeerId, localPlayerId])

  React.useEffect(() => {
    if (!isClient) {
      hostRef.current?.broadcastSnapshot()
    }

    if (snapshot.phase === 'GameOver') {
      saveArchivedGame(snapshot).catch(() => undefined)
    }
  }, [isClient, snapshot])

  function updateHostSnapshot(updater: (currentSnapshot: GameSnapshot) => GameSnapshot) {
    if (isClient) return
    setSnapshot((currentSnapshot) => updater(currentSnapshot))
  }

  function sendAction(action: ClientAction) {
    if (isClient) {
      clientRef.current?.sendAction(action)
      return
    }

    setSnapshot((currentSnapshot) => applyClientAction(currentSnapshot, action))
  }

  if (!displayName.trim()) {
    return (
      <main className="grid h-screen place-items-center bg-background px-5 text-text">
        <form
          className="w-full max-w-sm space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const name = String(formData.get('name') ?? '').trim()
            if (!name) return
            window.localStorage.setItem('mafia-player-name', JSON.stringify(name))
            setDisplayName(name)
          }}
        >
          <h1 className="text-center text-4xl font-black">Mafia</h1>
          <input
            name="name"
            autoFocus
            placeholder="Ваше имя"
            className="h-14 w-full rounded-xl border border-white/10 bg-surface px-4 text-lg font-semibold text-text outline-none focus:border-accent"
          />
          <Button className="w-full" variant="primary">
            Войти
          </Button>
        </form>
      </main>
    )
  }

  return (
    <motion.main
      animate={{ background: getPhaseBackground(snapshot.phase) }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
      className="grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden px-4 py-4 text-text sm:px-6"
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-black">{roomCode}</p>
          <p className="text-xs font-semibold text-muted">{isClient ? (clientConnected ? 'Клиент' : 'Подключение') : 'Хост'}</p>
        </div>

        <div className="flex items-center gap-2">
          {inviteQr && !isClient ? <img src={inviteQr} alt="QR" className="h-14 w-14 rounded-lg bg-white p-1" /> : null}
          <Button variant="ghost" className="h-11 min-h-0 px-3 py-2" onClick={onLeave}>
            Выйти
          </Button>
        </div>
      </header>

      <section className="mx-auto grid min-h-0 w-full max-w-5xl grid-rows-[auto_1fr] gap-4 py-5">
        <div className="text-center">
          <motion.p
            key={snapshot.phase}
            initial={{ opacity: 0, y: 8, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            className="text-5xl font-black sm:text-7xl"
          >
            {phaseLabels[snapshot.phase]}
          </motion.p>
          <p className="mt-2 font-mono text-4xl font-black tabular-nums sm:text-6xl">{formatTimer(secondsLeft)}</p>
        </div>

        {snapshot.phase === 'Lobby' ? (
          <div className="grid content-center gap-3">
            <Button disabled={isClient} onClick={() => updateHostSnapshot((current) => seedDemoPlayers(current, samplePlayerNames))}>
              Добавить игроков
            </Button>
            <Button variant="primary" disabled={isClient || snapshot.players.length < 4} onClick={() => updateHostSnapshot(startGame)}>
              Старт
            </Button>
            <PlayerStrip snapshot={snapshot} selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId} developerMode={developerMode} />
          </div>
        ) : selfPlayer ? (
          <PlayerActionPanel
            snapshot={snapshot}
            selfPlayer={selfPlayer}
            selectedPlayerId={selectedPlayerId}
            developerMode={developerMode}
            onSelectPlayer={setSelectedPlayerId}
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
      </section>

      <footer className="mx-auto grid w-full max-w-5xl grid-cols-3 gap-2">
        <PhaseButton phase={snapshot.phase} target="Night" disabled={isClient || snapshot.phase !== 'Night'} onClick={() => updateHostSnapshot(resolveNight)}>
          Ночь
        </PhaseButton>
        <PhaseButton
          phase={snapshot.phase}
          target="Discussion"
          disabled={isClient || !['NightResults', 'VoteResults'].includes(snapshot.phase)}
          onClick={() => updateHostSnapshot(snapshot.phase === 'NightResults' ? moveToDiscussion : moveToNextNight)}
        >
          День
        </PhaseButton>
        <PhaseButton phase={snapshot.phase} target="Voting" disabled={isClient || snapshot.phase !== 'Discussion'} onClick={() => updateHostSnapshot(moveToVoting)}>
          Голос
        </PhaseButton>
        {snapshot.phase === 'Voting' ? (
          <Button className="col-span-3" variant="primary" disabled={isClient} onClick={() => updateHostSnapshot(resolveVotes)}>
            Итоги
          </Button>
        ) : null}
      </footer>
    </motion.main>
  )
}

function PlayerStrip({
  snapshot,
  selectedPlayerId,
  developerMode,
  onSelectPlayer
}: {
  snapshot: GameSnapshot
  selectedPlayerId?: PlayerId
  developerMode: boolean
  onSelectPlayer: (playerId: PlayerId) => void
}) {
  return (
    <div className="grid max-h-72 gap-2 overflow-auto">
      {snapshot.players.map((player) => (
        <button
          key={player.id}
          className={[
            'rounded-xl px-4 py-3 text-left font-semibold transition',
            selectedPlayerId === player.id ? 'bg-accent text-white' : 'bg-surface text-text'
          ].join(' ')}
          onClick={() => onSelectPlayer(player.id)}
        >
          {player.name}
          {developerMode ? <span className="ml-2 text-xs opacity-70">{player.role}</span> : null}
        </button>
      ))}
    </div>
  )
}

function PhaseButton({
  phase,
  target,
  children,
  disabled,
  onClick
}: {
  phase: GamePhase
  target: GamePhase
  children: React.ReactNode
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button variant={phase === target ? 'primary' : 'secondary'} disabled={disabled} className="h-11 min-h-0 px-2 py-2" onClick={onClick}>
      {children}
    </Button>
  )
}

function applyClientAction(snapshot: GameSnapshot, action: ClientAction): GameSnapshot {
  if (action.type === 'joinRoom') {
    const alreadyJoined = snapshot.players.some((player) => player.id === action.playerId)
    if (alreadyJoined) return snapshot

    return addPlayer(snapshot, {
      id: action.playerId,
      name: action.playerName
    })
  }

  if (action.type === 'nightAction') return submitNightAction(snapshot, action.action)
  if (action.type === 'vote') return submitVote(snapshot, action.vote)

  return snapshot
}

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getPhaseBackground(phase: GamePhase): string {
  if (phase === 'Night') return 'linear-gradient(180deg, #050713 0%, #0B1024 100%)'
  if (phase === 'Discussion') return 'linear-gradient(180deg, #101827 0%, #142019 100%)'
  if (phase === 'Voting') return 'linear-gradient(180deg, #1C1020 0%, #111827 100%)'
  if (phase === 'GameOver') return 'linear-gradient(180deg, #160B22 0%, #0B0F19 100%)'
  return 'linear-gradient(180deg, #0B0F19 0%, #111827 100%)'
}
