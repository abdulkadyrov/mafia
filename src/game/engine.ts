import {
  ClientGameSnapshot,
  ConfirmationVote,
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
import { assignRandomRoles, countRoles, normalizeRoleSettings, resetPlayersForGame } from './roles'

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
  Voting: 'votingSeconds',
  Confirmation: 'votingSeconds'
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
    confirmationVotes: [],
    nightActions: [],
    chatLog: [],
    history: [],
    phaseStartedAt: Date.now(),
    detectiveKnowledge: {}
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
  const manualRoles = normalizeRoleSettings(countRoles(snapshot.players), snapshot.players.length)
  const shouldUseManualRoles = snapshot.settings.roleAssignmentMode === 'manual'
  const players = shouldUseManualRoles ? resetPlayersForGame(snapshot.players) : assignRandomRoles(snapshot.players, normalizedRoles)

  const startedSnapshot: GameSnapshot = {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      roles: shouldUseManualRoles ? manualRoles : normalizedRoles
    },
    players,
    phase: 'Night',
    round: 1,
    votes: [],
    confirmationVotes: [],
    nightActions: [],
    detectiveKnowledge: {},
    winner: undefined,
    mvpPlayerId: undefined,
    lastNightResolution: undefined,
    lastVoteResolution: undefined
  }

  return enterPhase(addSystemMessage(startedSnapshot, 'Наступила ночь'), 'Night')
}

export function updateRoomSettings(snapshot: GameSnapshot, settings: RoomSettings): GameSnapshot {
  if (snapshot.phase !== 'Lobby') return snapshot

  return {
    ...snapshot,
    settings: {
      ...settings,
      playerLimit: Math.max(settings.playerLimit, snapshot.players.length),
      roles: normalizeRoleSettings(settings.roles, snapshot.players.length)
    }
  }
}

export function assignPlayerRole(snapshot: GameSnapshot, playerId: PlayerId, role: Player['role']): GameSnapshot {
  if (snapshot.phase !== 'Lobby') return snapshot

  return {
    ...snapshot,
    players: snapshot.players.map((player) => (player.id === playerId ? { ...player, role } : player)),
    settings: {
      ...snapshot.settings,
      roleAssignmentMode: 'manual',
      roles: countRoles(snapshot.players.map((player) => (player.id === playerId ? { ...player, role } : player)))
    }
  }
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

  const killActions = [...getResolvedMafiaKillActions(snapshot), ...snapshot.nightActions.filter((action) => action.type === 'detectiveKill')]

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
      score: calculateNightScore(player, deaths, savedPlayerIds, snapshot.nightActions, snapshot)
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
    detectiveKnowledge: buildDetectiveKnowledge(snapshot, detectiveChecks),
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

  const resolution: VoteResolution = {
    eliminatedPlayerId: undefined,
    tiedPlayerIds: tiedPlayerIds.length > 1 ? tiedPlayerIds : [],
    confirmationCandidateIds: tiedPlayerIds,
    votesByTarget,
    confirmationVotesByTarget: {}
  }

  if (tiedPlayerIds.length === 0) {
    return enterPhase(
      {
        ...addSystemMessage(snapshot, 'Город не смог выбрать цель'),
        votes: [],
        confirmationVotes: [],
        lastVoteResolution: resolution
      },
      'VoteResults'
    )
  }

  return enterPhase(
    {
      ...addSystemMessage(snapshot, 'Город переходит к подтверждению исключения'),
      confirmationVotes: [],
      lastVoteResolution: resolution
    },
    'Confirmation'
  )
}

export function submitConfirmationVote(snapshot: GameSnapshot, vote: ConfirmationVote): GameSnapshot {
  const voter = snapshot.players.find((player) => player.id === vote.voterId)
  const target = snapshot.players.find((player) => player.id === vote.targetId)
  const candidates = snapshot.lastVoteResolution?.confirmationCandidateIds ?? []

  if (!voter || !target || !voter.alive || !target.alive || snapshot.phase !== 'Confirmation') {
    return snapshot
  }

  if (!candidates.includes(vote.targetId)) {
    return snapshot
  }

  const votes = snapshot.confirmationVotes.filter((existingVote) => {
    return existingVote.voterId !== vote.voterId || existingVote.targetId !== vote.targetId
  })

  return {
    ...snapshot,
    confirmationVotes: [...votes, vote]
  }
}

export function resolveConfirmation(snapshot: GameSnapshot): GameSnapshot {
  const candidates = snapshot.lastVoteResolution?.confirmationCandidateIds ?? []
  const confirmationVotesByTarget = candidates.reduce<Record<PlayerId, { exclude: number; keep: number }>>((accumulator, candidateId) => {
    accumulator[candidateId] = { exclude: 0, keep: 0 }
    return accumulator
  }, {})

  for (const vote of snapshot.confirmationVotes) {
    const current = confirmationVotesByTarget[vote.targetId]
    if (!current) continue
    current[vote.decision] += 1
  }

  const excludedCandidates = Object.entries(confirmationVotesByTarget)
    .filter(([, result]) => result.exclude > result.keep)
    .sort(([, first], [, second]) => second.exclude - first.exclude)

  const eliminatedPlayerId = excludedCandidates[0]?.[0]

  const players = snapshot.players.map((player) => {
    const eliminated = player.id === eliminatedPlayerId
    const vote = snapshot.votes.find((item) => item.voterId === player.id)
    const guessedCorrectly = vote?.targetId === eliminatedPlayerId
    const betDelta = snapshot.settings.bettingMode && vote ? (guessedCorrectly ? vote.bet : -vote.bet) : 0

    return {
      ...player,
      alive: eliminated ? false : player.alive,
      deathReason: eliminated ? 'vote' : player.deathReason,
      score: player.score + betDelta + (guessedCorrectly && eliminated ? 2 : 0)
    }
  })

  const resolution: VoteResolution = {
    eliminatedPlayerId,
    tiedPlayerIds: snapshot.lastVoteResolution?.tiedPlayerIds ?? [],
    confirmationCandidateIds: candidates,
    votesByTarget: snapshot.lastVoteResolution?.votesByTarget ?? {},
    confirmationVotesByTarget
  }

  let resolvedSnapshot: GameSnapshot = {
    ...snapshot,
    players,
    votes: [],
    confirmationVotes: [],
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
  nightActions: NightAction[],
  snapshot: GameSnapshot
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
  if (savedSomeone) delta += 2
  if (mafiaKilled) delta += 3

  if (detectiveTargetDeath) {
    const killedPlayer = snapshot.players.find((target) => target.id === detectiveTargetDeath.playerId)
    const knewTarget = (snapshot.detectiveKnowledge[player.id] ?? []).includes(detectiveTargetDeath.playerId)

    if (killedPlayer?.role === 'mafia') {
      delta += knewTarget ? 3 : 6
    } else {
      delta -= 4
    }
  }

  return player.score + delta
}

function getResolvedMafiaKillActions(snapshot: GameSnapshot): NightAction[] {
  const mafiaActions = snapshot.nightActions.filter((action) => action.type === 'mafiaKill')

  if (mafiaActions.length === 0) return []

  const aliveMafiaIds = snapshot.players.filter((player) => player.alive && player.role === 'mafia').map((player) => player.id)
  const votesByTarget = mafiaActions.reduce<Record<PlayerId, NightAction[]>>((accumulator, action) => {
    accumulator[action.targetId] = [...(accumulator[action.targetId] ?? []), action]
    return accumulator
  }, {})

  if (snapshot.settings.mafiaDecisionMode === 'unanimity') {
    const unanimousTarget = Object.entries(votesByTarget).find(([, actions]) => actions.length === aliveMafiaIds.length)
    return unanimousTarget ? [unanimousTarget[1][0]] : []
  }

  const [targetActions] = Object.values(votesByTarget).sort((first, second) => second.length - first.length)
  return targetActions ? [targetActions[0]] : []
}

function buildDetectiveKnowledge(
  snapshot: GameSnapshot,
  checks: NightResolution['detectiveChecks']
): Record<PlayerId, PlayerId[]> {
  const nextKnowledge: Record<PlayerId, PlayerId[]> = { ...snapshot.detectiveKnowledge }

  for (const check of checks) {
    nextKnowledge[check.detectiveId] = [...new Set([...(nextKnowledge[check.detectiveId] ?? []), check.targetId])]
  }

  return nextKnowledge
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
