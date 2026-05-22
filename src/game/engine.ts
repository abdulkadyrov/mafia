import { Player, Phase, Role } from './types'

export type NightAction = {
  actorId: string
  type: 'kill' | 'heal' | 'check'
  targetId: string
}

export type Vote = {
  voterId: string
  targetId: string
}

export class GameEngine {
  private players: Player[]
  private phase: Phase = 'Lobby'
  private round = 0
  private nightActions: NightAction[] = []
  private votes: Vote[] = []

  constructor(players: Player[]) {
    this.players = players
  }

  getState() {
    return {
      players: this.players,
      phase: this.phase,
      round: this.round
    }
  }

  start() {
    this.round = 1
    this.phase = 'Night'
  }

  submitNightAction(action: NightAction) {
    this.nightActions.push(action)
  }

  computeNightResults() {
    // Basic deterministic resolution: apply heals first, then kills
    const healed = new Set<string>()
    const kills: string[] = []
    for (const a of this.nightActions) {
      if (a.type === 'heal') healed.add(a.targetId)
      if (a.type === 'kill') kills.push(a.targetId)
    }

    const deaths: string[] = []
    for (const target of kills) {
      if (!healed.has(target)) deaths.push(target)
    }

    for (const id of deaths) {
      const p = this.players.find((x) => x.id === id)
      if (p) p.alive = false
    }

    this.nightActions = []
    this.phase = 'NightResults'
    return { deaths }
  }

  submitVote(vote: Vote) {
    this.votes.push(vote)
  }

  computeVoteResults() {
    const tally = new Map<string, number>()
    for (const v of this.votes) {
      tally.set(v.targetId, (tally.get(v.targetId) || 0) + 1)
    }
    // find max
    let max = 0
    let loser: string | null = null
    for (const [id, count] of tally.entries()) {
      if (count > max) {
        max = count
        loser = id
      }
    }

    if (loser) {
      const p = this.players.find((x) => x.id === loser)
      if (p) p.alive = false
    }

    this.votes = []
    this.phase = 'VoteResults'
    return { loser }
  }
}
