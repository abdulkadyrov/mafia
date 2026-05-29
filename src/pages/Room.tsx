import React from 'react'
import { motion } from 'framer-motion'
import { PlayerActionPanel } from '../features/game-actions/PlayerActionPanel'
import { RoomSettingsForm } from '../features/room-settings/RoomSettingsForm'
import {
  addPlayer,
  assignPlayerRole,
  createInitialSnapshot,
  moveToDiscussion,
  moveToNextNight,
  moveToVoting,
  resolveConfirmation,
  resolveNight,
  resolveVotes,
  seedDemoPlayers,
  startGame,
  submitConfirmationVote,
  submitNightAction,
  submitVote,
  updateRoomSettings
} from '../game/engine'
import { createId } from '../game/id'
import { samplePlayerNames } from '../game/defaults'
import { useCountdown } from '../hooks/useCountdown'
import { ClientNetwork } from '../network/ClientNetwork'
import { HostNetwork } from '../network/HostNetwork'
import { isLanRelayMode, LanRelayClientNetwork, LanRelayHostNetwork } from '../network/LanRelayNetwork'
import { createRoomPeerId, generateQRCode } from '../network/RoomService'
import { saveArchivedGame } from '../services/storage/GameArchiveService'
import { createHashAppPath } from '../shared/routing/basePath'
import { Button } from '../shared/ui/Button'
import { GameOverPanel } from '../widgets/GameOverPanel'
import { SystemFeed } from '../widgets/SystemFeed'
import { ClientAction, GamePhase, GameSnapshot, PlayerId, Role, RoomSettings, phaseLabels, roleLabels } from '../types/game'

type Props = {
  onLeave: () => void
  roomCode: string
  settings: RoomSettings
  developerMode: boolean
  playerName: string
  joinPeerId?: string
}

type HostConnection = HostNetwork | LanRelayHostNetwork
type ClientConnection = ClientNetwork | LanRelayClientNetwork

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
  const useLanRelay = isLanRelayMode()
  const [networkStatus, setNetworkStatus] = React.useState<'idle' | 'hosting' | 'connecting' | 'connected' | 'failed'>('idle')
  const [networkMessage, setNetworkMessage] = React.useState('')
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<PlayerId>(localPlayerId)
  const hostRef = React.useRef<HostConnection>()
  const clientRef = React.useRef<ClientConnection>()
  const snapshotRef = React.useRef(snapshot)
  const secondsLeft = useCountdown(snapshot.phaseEndsAt)
  const selfPlayer = snapshot.players.find((player) => player.id === localPlayerId) ?? snapshot.players[0]

  React.useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  React.useEffect(() => {
    if (isClient || !displayName.trim()) return undefined

    const host = useLanRelay
      ? new LanRelayHostNetwork(roomCode, () => snapshotRef.current, (_peerId, action: ClientAction) => {
          setSnapshot((currentSnapshot) => applyClientAction(currentSnapshot, action))
        })
      : new HostNetwork(roomCode, () => snapshotRef.current, (_peerId, action: ClientAction) => {
          setSnapshot((currentSnapshot) => applyClientAction(currentSnapshot, action))
        })

    hostRef.current = host
    host
      .start()
      .then(async (peerId) => {
        setNetworkStatus('hosting')
        setNetworkMessage(useLanRelay ? 'LAN-сервер готов. Подключайте телефон по этому же адресу.' : `Комната готова: ${peerId}`)
        const inviteUrl = `${location.origin}${createHashAppPath(`/room/${roomCode}`)}?peer=${encodeURIComponent(peerId)}`
        setInviteQr(await generateQRCode(inviteUrl))
      })
      .catch((error) => {
        setNetworkStatus('failed')
        setNetworkMessage(error instanceof Error ? error.message : 'Не удалось создать комнату')
      })

    return () => {
      host.stop()
      hostRef.current = undefined
    }
  }, [displayName, isClient, roomCode, useLanRelay])

  React.useEffect(() => {
    if (!joinPeerId || !displayName.trim()) return undefined

    setNetworkStatus('connecting')
    setNetworkMessage('Подключение к комнате...')

    const client = useLanRelay
      ? new LanRelayClientNetwork(
          (remoteSnapshot) => {
            setSnapshot(remoteSnapshot)
          },
          (message) => {
            setNetworkStatus('failed')
            setNetworkMessage(message)
          }
        )
      : new ClientNetwork(
          (remoteSnapshot) => {
            setSnapshot(remoteSnapshot)
          },
          (message) => {
            setNetworkStatus('failed')
            setNetworkMessage(message)
          }
        )

    clientRef.current = client
    client
      .join(useLanRelay ? joinPeerId : createRoomPeerId(joinPeerId))
      .then(() => {
        setNetworkStatus('connected')
        setNetworkMessage('Подключено')
        client.sendAction({
          type: 'joinRoom',
          playerId: localPlayerId,
          playerName: displayName.trim()
        })
      })
      .catch((error) => {
        setNetworkStatus('failed')
        setNetworkMessage(error instanceof Error ? error.message : 'Не удалось подключиться к комнате')
      })

    return () => {
      client.destroy()
      clientRef.current = undefined
    }
  }, [displayName, joinPeerId, localPlayerId, useLanRelay])

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
      className={[
        'grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden px-4 py-4 sm:px-6',
        snapshot.phase === 'Discussion' ? 'text-[#111111]' : 'text-text'
      ].join(' ')}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xl font-black">{roomCode}</p>
          <p className="text-xs font-semibold text-muted">{isClient ? getNetworkLabel(networkStatus) : 'Администратор'}</p>
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
          <div className="grid min-h-0 gap-4 overflow-auto lg:grid-cols-[1fr_1.1fr]">
            <div className="grid content-start gap-3">
              <NetworkNotice
                isClient={isClient}
                roomCode={roomCode}
                networkStatus={networkStatus}
                networkMessage={networkMessage}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={isClient} onClick={() => updateHostSnapshot((current) => seedDemoPlayers(current, samplePlayerNames))}>
                  Игроки
                </Button>
                <Button variant="primary" disabled={isClient || snapshot.players.length < 4} onClick={() => updateHostSnapshot(startGame)}>
                  Старт
                </Button>
              </div>
              <PlayerStrip
                snapshot={snapshot}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                developerMode={developerMode || snapshot.settings.roleAssignmentMode === 'manual'}
                disabled={isClient}
                onAssignRole={(playerId, role) => updateHostSnapshot((current) => assignPlayerRole(current, playerId, role))}
              />
            </div>
            <RoomSettingsForm settings={snapshot.settings} onChange={(nextSettings) => updateHostSnapshot((current) => updateRoomSettings(current, nextSettings))} />
          </div>
        ) : selfPlayer ? (
          <div className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[1fr_24rem]">
            <div className="min-h-0 overflow-auto">
              <GameOverPanel snapshot={snapshot} />
              {snapshot.phase !== 'GameOver' ? (
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
                  onConfirmationVote={(vote) => {
                    sendAction({
                      type: 'confirmationVote',
                      vote
                    })
                  }}
                />
              ) : null}
            </div>
            <div className="min-h-0 overflow-auto">
              <SystemFeed snapshot={snapshot} selfPlayerId={selfPlayer.id} />
            </div>
          </div>
        ) : null}
      </section>

      <footer className="mx-auto grid w-full max-w-5xl grid-cols-3 gap-2 sm:grid-cols-6">
        <PhaseButton phase={snapshot.phase} target="Night" disabled={isClient || snapshot.phase !== 'Night'} onClick={() => updateHostSnapshot(resolveNight)}>
          Завершить ночь
        </PhaseButton>
        <PhaseButton
          phase={snapshot.phase}
          target="Discussion"
          disabled={isClient || !['NightResults', 'VoteResults'].includes(snapshot.phase)}
          onClick={() => updateHostSnapshot(snapshot.phase === 'NightResults' ? moveToDiscussion : moveToNextNight)}
        >
          День/Ночь
        </PhaseButton>
        <PhaseButton phase={snapshot.phase} target="Voting" disabled={isClient || snapshot.phase !== 'Discussion'} onClick={() => updateHostSnapshot(moveToVoting)}>
          Голосование
        </PhaseButton>
        {snapshot.phase === 'Voting' ? (
          <Button className="col-span-3 sm:col-span-1" variant="primary" disabled={isClient} onClick={() => updateHostSnapshot(resolveVotes)}>
            Завершить
          </Button>
        ) : null}
        {snapshot.phase === 'Confirmation' ? (
          <Button className="col-span-3 sm:col-span-1" variant="primary" disabled={isClient} onClick={() => updateHostSnapshot(resolveConfirmation)}>
            Подтвердить
          </Button>
        ) : null}
        {snapshot.phase !== 'Lobby' ? (
          <Button className="col-span-3 sm:col-span-1" variant="ghost" disabled={isClient} onClick={() => updateHostSnapshot(startGame)}>
            Рестарт
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
  disabled,
  onSelectPlayer,
  onAssignRole
}: {
  snapshot: GameSnapshot
  selectedPlayerId?: PlayerId
  developerMode: boolean
  disabled: boolean
  onSelectPlayer: (playerId: PlayerId) => void
  onAssignRole: (playerId: PlayerId, role: Role) => void
}) {
  return (
    <div className="grid max-h-72 gap-2 overflow-auto">
      {snapshot.players.map((player) => (
        <div key={player.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-surface p-2">
          <button
            className={[
              'min-w-0 rounded-lg px-3 py-2 text-left font-semibold transition',
              selectedPlayerId === player.id ? 'bg-accent text-white' : 'text-text hover:bg-white/5'
            ].join(' ')}
            onClick={() => onSelectPlayer(player.id)}
          >
            <span className="block truncate">{player.name}</span>
            {developerMode ? <span className="block text-xs opacity-70">{roleLabels[player.role]}</span> : null}
          </button>
          {developerMode ? (
            <select
              value={player.role}
              disabled={disabled}
              onChange={(event) => onAssignRole(player.id, event.target.value as Role)}
              className="rounded-lg border border-white/10 bg-background px-2 text-xs font-semibold text-text outline-none"
            >
              {(Object.keys(roleLabels) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          ) : null}
        </div>
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

function NetworkNotice({
  isClient,
  roomCode,
  networkStatus,
  networkMessage
}: {
  isClient: boolean
  roomCode: string
  networkStatus: 'idle' | 'hosting' | 'connecting' | 'connected' | 'failed'
  networkMessage: string
}) {
  if (!isClient && networkStatus !== 'failed') {
    return (
      <div className="rounded-xl bg-surface/80 px-4 py-3">
        <p className="text-sm font-semibold text-text">Код комнаты</p>
        <p className="mt-1 font-mono text-3xl font-black tracking-[0.16em] text-text">{roomCode}</p>
        <p className="mt-2 text-xs font-medium text-muted">Телефон должен быть в той же Wi-Fi сети и ввести этот код.</p>
      </div>
    )
  }

  return (
    <div className={['rounded-xl px-4 py-3', networkStatus === 'failed' ? 'bg-danger/20' : 'bg-surface/80'].join(' ')}>
      <p className="text-sm font-semibold text-text">{getNetworkLabel(networkStatus)}</p>
      <p className="mt-1 text-xs font-medium text-muted">{networkMessage || 'Ожидание соединения'}</p>
    </div>
  )
}

function getNetworkLabel(status: 'idle' | 'hosting' | 'connecting' | 'connected' | 'failed'): string {
  if (status === 'hosting') return 'Комната создана'
  if (status === 'connecting') return 'Подключение'
  if (status === 'connected') return 'Подключено'
  if (status === 'failed') return 'Ошибка сети'
  return 'Ожидание'
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
  if (action.type === 'confirmationVote') return submitConfirmationVote(snapshot, action.vote)

  return snapshot
}

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getPhaseBackground(phase: GamePhase): string {
  if (phase === 'Night') return 'linear-gradient(180deg, #050713 0%, #0B1024 100%)'
  if (phase === 'Discussion') return 'linear-gradient(180deg, #F5F5F5 0%, #E5E7EB 100%)'
  if (phase === 'Voting' || phase === 'Confirmation') return 'linear-gradient(180deg, #111827 0%, #374151 100%)'
  if (phase === 'GameOver') return 'linear-gradient(180deg, #160B22 0%, #0B0F19 100%)'
  return 'linear-gradient(180deg, #0B0F19 0%, #111827 100%)'
}
