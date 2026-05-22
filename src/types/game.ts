export type PlayerId = string

export type Role = 'mafia' | 'doctor' | 'detective' | 'civilian'

export type Team = 'mafia' | 'city'

export type GamePhase =
  | 'Lobby'
  | 'Night'
  | 'NightResults'
  | 'Discussion'
  | 'Voting'
  | 'VoteResults'
  | 'GameOver'

export type DeathReason = 'mafia' | 'detective' | 'vote'

export type NightActionType = 'mafiaKill' | 'doctorHeal' | 'detectiveCheck' | 'detectiveKill'

export type TimerSettings = {
  nightSeconds: number
  discussionSeconds: number
  votingSeconds: number
}

export type RoleSettings = {
  mafia: number
  doctors: number
  detectives: number
  civilians: number
}

export type RoomSettings = {
  playerLimit: number
  roles: RoleSettings
  timers: TimerSettings
  revealRolesAfterDeath: boolean
  showActionHistory: boolean
  bettingMode: boolean
  privateRoom: boolean
  autoStart: boolean
  doctorSelfHealsLimit: number
}

export type Player = {
  id: PlayerId
  name: string
  role: Role
  alive: boolean
  score: number
  connected: boolean
  isHost: boolean
  selfHealsUsed: number
  joinedAt: number
  killedBy?: PlayerId
  deathReason?: DeathReason
}

export type PublicPlayer = Omit<Player, 'role'> & {
  role?: Role
}

export type NightAction = {
  id: string
  actorId: PlayerId
  targetId: PlayerId
  type: NightActionType
  createdAt: number
}

export type Vote = {
  voterId: PlayerId
  targetId: PlayerId
  bet: number
}

export type ChatEntry = {
  id: string
  text: string
  createdAt: number
  visibility: 'system' | 'private'
  recipientId?: PlayerId
}

export type HistoryEntry = {
  id: string
  phase: GamePhase
  round: number
  text: string
  createdAt: number
  privateFor?: PlayerId
}

export type DeathNotice = {
  playerId: PlayerId
  killerId?: PlayerId
  reason: DeathReason
  text: string
}

export type NightResolution = {
  deaths: DeathNotice[]
  savedPlayerIds: PlayerId[]
  detectiveChecks: Array<{
    detectiveId: PlayerId
    targetId: PlayerId
    targetRole: Role
  }>
}

export type VoteResolution = {
  eliminatedPlayerId?: PlayerId
  tiedPlayerIds: PlayerId[]
  votesByTarget: Record<PlayerId, number>
}

export type Winner = 'mafia' | 'city'

export type GameSnapshot = {
  roomCode: string
  settings: RoomSettings
  players: Player[]
  phase: GamePhase
  round: number
  hostPeerId?: string
  votes: Vote[]
  nightActions: NightAction[]
  chatLog: ChatEntry[]
  history: HistoryEntry[]
  phaseStartedAt: number
  phaseEndsAt?: number
  winner?: Winner
  mvpPlayerId?: PlayerId
  lastNightResolution?: NightResolution
  lastVoteResolution?: VoteResolution
}

export type ClientGameSnapshot = Omit<GameSnapshot, 'players'> & {
  players: PublicPlayer[]
  selfPlayerId?: PlayerId
}

export type ClientAction =
  | {
      type: 'joinRoom'
      playerName: string
    }
  | {
      type: 'nightAction'
      action: Omit<NightAction, 'id' | 'createdAt'>
    }
  | {
      type: 'vote'
      vote: Vote
    }
  | {
      type: 'requestSnapshot'
    }

export const roleLabels: Record<Role, string> = {
  mafia: 'Мафия',
  doctor: 'Доктор',
  detective: 'Детектив',
  civilian: 'Мирный'
}

export const phaseLabels: Record<GamePhase, string> = {
  Lobby: 'Лобби',
  Night: 'Ночь',
  NightResults: 'Итоги ночи',
  Discussion: 'Обсуждение',
  Voting: 'Голосование',
  VoteResults: 'Итоги голосования',
  GameOver: 'Конец игры'
}
