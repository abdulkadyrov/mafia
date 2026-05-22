import {
  ClientGameSnapshot,
  DeathNotice,
  GamePhase,
  GameSnapshot,
  HistoryEntry,
  NightAction,
  NightResolution,
  Player,
  PlayerId,
  RoomSettings,
  Vote,
  VoteResolution,
  Winner
} from '../types/game'
import { defaultRoomSettings } from './defaults'
import { createId } from './id'
import { assignRoles, normalizeRoleSettings } from './roles'

type CreateSnapshotInput = {
  roomCode: string
  settings?: RoomSettings
  hostPeerId?: string
}

type CreatePlayerInput = {
  id?: string
  name: string
  isHost?: boolean
}

const phaseDurations: Partial<Record<GamePhase, keyof RoomSettings['timers']>> = {
  Night: 'nightSeconds',
  Discussion: 'discussionSeconds',
  Voting: 'votingSeconds'
}

export function createInitialSnapshot(input: CreateSnapshotInput): GameSnapshot {
  const settings = input.settings ?? defaultRoomSettings

  return {
    roomCode: input.roomCode,
    settings,
    players: [],
    phase: 'Lobby',
    round: 0,
    hostPeerId: input.hostPeerId,
    votes: [],
    nightActions: [],
    chatLog: [],
    history: [],
    phaseStartedAt: Date.now()
  }
}

export function createPlayer(input: CreatePlayerInput): Player {
  return {
    id: input.id ?? createId('player'),
    name: input.name.trim() || 'Игрок',
    role: 'civilian',
    alive: true,
    score: 0,
    connected: true,
    isHost: Boolean(input.isHost),
    selfHealsUsed: 0,
    joinedAt: Date.now()
  }
}

export function addPlayer(snapshot: GameSnapshot, input: CreatePlayerInput): GameSnapshot {
  if (snapshot.players.length >= snapshot.settings.playerLimit) {
    return addSystemMessage(snapshot, 'Комната заполнена')
  }

  const player = createPlayer(input)
  const withPlayer: GameSnapshot = {
    ...snapshot,
    players: [...snapshot.players, player]
  }

  return addSystemMessage(withPlayer, `${player.name} подключился к комнате`)
}

export function seedDemoPlayers(snapshot: GameSnapshot, names: string[]): GameSnapshot {
  const needed = Math.max(0, snapshot.settings.playerLimit - snapshot.players.length)
  const playersToAdd = names.slice(0, needed)

  return playersToAdd.reduce((currentSnapshot, name, index) => {
    return addPlayer(currentSnapshot, {
      name,
      isHost: currentSnapshot.players.length === 0 && index === 0
    })
  }, snapshot)
}

export function startGame(snapshot: GameSnapshot): GameSnapshot {
  const normalizedRoles = normalizeRoleSettings(snapshot.settings.roles, snapshot.players.length)
  const players = assignRoles(snapshot.players, normalizedRoles)

  const startedSnapshot: GameSnapshot = {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      roles: normalizedRoles
    },
    players,
    phase: 'Night',
    round: 1,
    votes: [],
    nightActions: [],
    winner: undefined,
    mvpPlayerId: undefined,
    lastNightResolution: undefined,
    lastVoteResolution: undefined
  }

  return enterPhase(addSystemMessage(startedSnapshot, 'Наступила ночь'), 'Night')
}

export function enterPhase(snapshot: GameSnapshot, phase: GamePhase): GameSnapshot {
  const timerKey = phaseDurations[phase]
  const phaseStartedAt = Date.now()
  const phaseSeconds = timerKey ? snapshot.settings.timers[timerKey] : undefined

  return {
    ...snapshot,
    phase,
    phaseStartedAt,
    phaseEndsAt: phaseSeconds ? phaseStartedAt + phaseSeconds * 1000 : undefined
  }
}

export function submitNightAction(snapshot: GameSnapshot, action: Omit<NightAction, 'id' | 'createdAt'>): GameSnapshot {
  const actor = snapshot.players.find((player) => player.id === action.actorId)
  const target = snapshot.players.find((player) => player.id === action.targetId)

  if (!actor || !target || !actor.alive || !target.alive || snapshot.phase !== 'Night') {
    return snapshot
  }

  if (action.type === 'doctorHeal' && actor.id === target.id) {
    if (actor.selfHealsUsed >= snapshot.settings.doctorSelfHealsLimit) {
      return addPrivateHistory(snapshot, actor.id, 'Лимит самолечения уже использован')
    }
  }

  const withoutPreviousAction = snapshot.nightActions.filter((existingAction) => {
    return existingAction.actorId !== action.actorId || existingAction.type !== action.type
  })

  const nextAction: NightAction = {
    ...action,
    id: createId('night'),
    createdAt: Date.now()
  }

  return {
    ...snapshot,
    nightActions: [...withoutPreviousAction, nextAction]
  }
}

export function resolveNight(snapshot: GameSnapshot): GameSnapshot {
  const healedPlayerIds = new Set(
    snapshot.nightActions.filter((action) => action.type === 'doctorHeal').map((action) => action.targetId)
  )

  const killActions = snapshot.nightActions.filter((action) => {
    return action.type === 'mafiaKill' || action.type === 'detectiveKill'
  })

  const deaths: DeathNotice[] = []
  const savedPlayerIds: PlayerId[] = []

  for (const action of killActions) {
    if (healedPlayerIds.has(action.targetId)) {
      savedPlayerIds.push(action.targetId)
      continue
    }

    const alreadyDead = deaths.some((death) => death.playerId === action.targetId)
    if (alreadyDead) continue

    deaths.push({
      playerId: action.targetId,
      killerId: action.actorId,
      reason: action.type === 'mafiaKill' ? 'mafia' : 'detective',
      text: action.type === 'mafiaKill' ? 'Тебя убила мафия' : 'Тебя убил детектив'
    })
  }

  const detectiveChecks = snapshot.nightActions
    .filter((action) => action.type === 'detectiveCheck')
    .map((action) => {
      const target = snapshot.players.find((player) => player.id === action.targetId)

      return {
        detectiveId: action.actorId,
        targetId: action.targetId,
        targetRole: target?.role ?? 'civilian'
      }
    })

  const players = snapshot.players.map((player) => {
    const death = deaths.find((item) => item.playerId === player.id)
    const usedSelfHeal = snapshot.nightActions.some((action) => {
      return action.type === 'doctorHeal' && action.actorId === player.id && action.targetId === player.id
    })

    return {
      ...player,
      alive: death ? false : player.alive,
      killedBy: death?.killerId ?? player.killedBy,
      deathReason: death?.reason ?? player.deathReason,
      selfHealsUsed: usedSelfHeal ? player.selfHealsUsed + 1 : player.selfHealsUsed,
      score: calculateNightScore(player, deaths, savedPlayerIds, snapshot.nightActions)
    }
  })

  const resolution: NightResolution = {
    deaths,
    savedPlayerIds: [...new Set(savedPlayerIds)],
    detectiveChecks
  }

  let resolvedSnapshot: GameSnapshot = {
    ...snapshot,
    players,
    nightActions: [],
    lastNightResolution: resolution
  }

  resolvedSnapshot = addNightPublicMessages(resolvedSnapshot, resolution)
  resolvedSnapshot = addDetectivePrivateMessages(resolvedSnapshot, resolution)

  const winner = getWinner(resolvedSnapshot.players)

  if (winner) {
    return finishGame({
      ...resolvedSnapshot,
      winner
    })
  }

  return enterPhase(resolvedSnapshot, 'NightResults')
}

export function submitVote(snapshot: GameSnapshot, vote: Vote): GameSnapshot {
  const voter = snapshot.players.find((player) => player.id === vote.voterId)
  const target = snapshot.players.find((player) => player.id === vote.targetId)

  if (!voter || !target || !voter.alive || !target.alive || snapshot.phase !== 'Voting') {
    return snapshot
  }

  const cleanBet = Math.max(0, Math.min(vote.bet, voter.score))
  const votes = snapshot.votes.filter((existingVote) => existingVote.voterId !== vote.voterId)

  return {
    ...snapshot,
    votes: [
      ...votes,
      {
        ...vote,
        bet: cleanBet
      }
    ]
  }
}

export function resolveVotes(snapshot: GameSnapshot): GameSnapshot {
  const votesByTarget = snapshot.votes.reduce<Record<PlayerId, number>>((accumulator, vote) => {
    accumulator[vote.targetId] = (accumulator[vote.targetId] ?? 0) + 1
    return accumulator
  }, {})

  const maxVotes = Math.max(0, ...Object.values(votesByTarget))
  const tiedPlayerIds = Object.entries(votesByTarget)
    .filter(([, votes]) => votes === maxVotes)
    .map(([playerId]) => playerId)

  const eliminatedPlayerId = tiedPlayerIds.length === 1 ? tiedPlayerIds[0] : undefined

  const players = snapshot.players.map((player) => {
    const eliminated = player.id === eliminatedPlayerId
    const vote = snapshot.votes.find((item) => item.voterId === player.id)
    const guessedCorrectly = vote?.targetId === eliminatedPlayerId
    const betDelta = snapshot.settings.bettingMode && vote ? (guessedCorrectly ? vote.bet : -vote.bet) : 0

    return {
      ...player,
      alive: eliminated ? false : player.alive,
      deathReason: eliminated ? 'vote' : player.deathReason,
      score: player.score + betDelta
    }
  })

  const resolution: VoteResolution = {
    eliminatedPlayerId,
    tiedPlayerIds: tiedPlayerIds.length > 1 ? tiedPlayerIds : [],
    votesByTarget
  }

  let resolvedSnapshot: GameSnapshot = {
    ...snapshot,
    players,
    votes: [],
    lastVoteResolution: resolution
  }

  if (eliminatedPlayerId) {
    const eliminatedPlayer = players.find((player) => player.id === eliminatedPlayerId)
    resolvedSnapshot = addSystemMessage(resolvedSnapshot, `${eliminatedPlayer?.name ?? 'Игрок'} был изгнан`)
  } else {
    resolvedSnapshot = addSystemMessage(resolvedSnapshot, 'Город не смог выбрать цель')
  }

  const winner = getWinner(resolvedSnapshot.players)

  if (winner) {
    return finishGame({
      ...resolvedSnapshot,
      winner
    })
  }

  return enterPhase(resolvedSnapshot, 'VoteResults')
}

export function moveToDiscussion(snapshot: GameSnapshot): GameSnapshot {
  const aliveRewardedPlayers = snapshot.players.map((player) => ({
    ...player,
    score: player.alive ? player.score + 1 : player.score
  }))

  return enterPhase(
    addSystemMessage(
      {
        ...snapshot,
        players: aliveRewardedPlayers
      },
      'Наступил день'
    ),
    'Discussion'
  )
}

export function moveToVoting(snapshot: GameSnapshot): GameSnapshot {
  return enterPhase(addSystemMessage(snapshot, 'Началось голосование'), 'Voting')
}

export function moveToNextNight(snapshot: GameSnapshot): GameSnapshot {
  return enterPhase(
    addSystemMessage(
      {
        ...snapshot,
        round: snapshot.round + 1,
        lastNightResolution: undefined,
        lastVoteResolution: undefined
      },
      'Наступила ночь'
    ),
    'Night'
  )
}

export function toClientSnapshot(snapshot: GameSnapshot, selfPlayerId?: PlayerId): ClientGameSnapshot {
  const showRoles = snapshot.phase === 'GameOver' || snapshot.settings.revealRolesAfterDeath

  return {
    ...snapshot,
    selfPlayerId,
    players: snapshot.players.map((player) => {
      const canSeeRole = player.id === selfPlayerId || snapshot.phase === 'GameOver' || (showRoles && !player.alive)
      const publicPlayer = {
        ...player,
        role: canSeeRole ? player.role : undefined
      }

      return publicPlayer
    })
  }
}

function calculateNightScore(
  player: Player,
  deaths: DeathNotice[],
  savedPlayerIds: PlayerId[],
  nightActions: NightAction[]
): number {
  const savedSomeone = nightActions.some((action) => {
    return action.actorId === player.id && action.type === 'doctorHeal' && savedPlayerIds.includes(action.targetId)
  })

  const mafiaKilled = nightActions.some((action) => {
    return action.actorId === player.id && action.type === 'mafiaKill' && deaths.some((death) => death.playerId === action.targetId)
  })

  const detectiveKill = nightActions.find((action) => {
    return action.actorId === player.id && action.type === 'detectiveKill'
  })

  const detectiveTargetDeath = detectiveKill
    ? deaths.find((death) => death.playerId === detectiveKill.targetId && death.killerId === player.id)
    : undefined

  let delta = 0

  if (savedSomeone) delta += 2
  if (mafiaKilled) delta += 1

  if (detectiveTargetDeath) {
    delta += detectiveTargetDeath.reason === 'detective' ? 3 : 0
  }

  return player.score + delta
}

function addNightPublicMessages(snapshot: GameSnapshot, resolution: NightResolution): GameSnapshot {
  let nextSnapshot = snapshot

  for (const death of resolution.deaths) {
    const player = snapshot.players.find((item) => item.id === death.playerId)
    nextSnapshot = addSystemMessage(nextSnapshot, `${player?.name ?? 'Игрок'} был убит`)
  }

  for (const savedPlayerId of resolution.savedPlayerIds) {
    const player = snapshot.players.find((item) => item.id === savedPlayerId)
    nextSnapshot = addSystemMessage(nextSnapshot, `Доктор спас ${player?.name ?? 'игрока'}`)
  }

  if (resolution.deaths.length === 0 && resolution.savedPlayerIds.length === 0) {
    nextSnapshot = addSystemMessage(nextSnapshot, 'Ночь прошла тихо')
  }

  return nextSnapshot
}

function addDetectivePrivateMessages(snapshot: GameSnapshot, resolution: NightResolution): GameSnapshot {
  return resolution.detectiveChecks.reduce((currentSnapshot, check) => {
    const target = snapshot.players.find((player) => player.id === check.targetId)
    const isMafia = check.targetRole === 'mafia'

    return addPrivateHistory(
      currentSnapshot,
      check.detectiveId,
      `${target?.name ?? 'Игрок'} ${isMafia ? 'из мафии' : 'не из мафии'}`
    )
  }, snapshot)
}

function addSystemMessage(snapshot: GameSnapshot, text: string): GameSnapshot {
  const entry: HistoryEntry = {
    id: createId('history'),
    phase: snapshot.phase,
    round: snapshot.round,
    text,
    createdAt: Date.now()
  }

  return {
    ...snapshot,
    chatLog: [
      ...snapshot.chatLog,
      {
        id: entry.id,
        text,
        createdAt: entry.createdAt,
        visibility: 'system'
      }
    ],
    history: [...snapshot.history, entry]
  }
}

function addPrivateHistory(snapshot: GameSnapshot, playerId: PlayerId, text: string): GameSnapshot {
  const entry: HistoryEntry = {
    id: createId('history'),
    phase: snapshot.phase,
    round: snapshot.round,
    text,
    createdAt: Date.now(),
    privateFor: playerId
  }

  return {
    ...snapshot,
    history: [...snapshot.history, entry]
  }
}

function getWinner(players: Player[]): Winner | undefined {
  const alivePlayers = players.filter((player) => player.alive)
  const aliveMafia = alivePlayers.filter((player) => player.role === 'mafia').length
  const aliveCity = alivePlayers.length - aliveMafia

  if (aliveMafia === 0) return 'city'
  if (aliveMafia >= aliveCity) return 'mafia'
  return undefined
}

function finishGame(snapshot: GameSnapshot): GameSnapshot {
  const mvp = [...snapshot.players].sort((first, second) => second.score - first.score)[0]

  return enterPhase(
    {
      ...snapshot,
      phase: 'GameOver',
      winner: snapshot.winner,
      mvpPlayerId: mvp?.id
    },
    'GameOver'
  )
}
