export type PlayerId = string

export type Role = 'mafia' | 'doctor' | 'detective' | 'town'

export type Player = {
  id: PlayerId
  name: string
  role?: Role
  alive: boolean
  score: number
}

export type Phase =
  | 'Lobby'
  | 'Night'
  | 'NightResults'
  | 'Discussion'
  | 'Voting'
  | 'VoteResults'
  | 'GameOver'

export type ChatEntry = {
  id: string
  ts: number
  text: string
  system?: boolean
}
