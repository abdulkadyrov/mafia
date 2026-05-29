import { Player, Role, RoleSettings } from '../types/game'

const roleOrder: Role[] = ['mafia', 'doctor', 'detective', 'civilian']

export function buildRoleDeck(settings: RoleSettings): Role[] {
  return [
    ...Array.from({ length: settings.mafia }, () => 'mafia' as const),
    ...Array.from({ length: settings.doctors }, () => 'doctor' as const),
    ...Array.from({ length: settings.detectives }, () => 'detective' as const),
    ...Array.from({ length: settings.civilians }, () => 'civilian' as const)
  ]
}

export function countRoles(players: Player[]): RoleSettings {
  return {
    mafia: players.filter((player) => player.role === 'mafia').length,
    doctors: players.filter((player) => player.role === 'doctor').length,
    detectives: players.filter((player) => player.role === 'detective').length,
    civilians: players.filter((player) => player.role === 'civilian').length
  }
}

export function normalizeRoleSettings(settings: RoleSettings, playerLimit: number): RoleSettings {
  const safeSettings: RoleSettings = {
    mafia: Math.max(1, settings.mafia),
    doctors: Math.max(0, settings.doctors),
    detectives: Math.max(0, settings.detectives),
    civilians: Math.max(0, settings.civilians)
  }

  let total = buildRoleDeck(safeSettings).length

  while (total < playerLimit) {
    safeSettings.civilians += 1
    total += 1
  }

  while (total > playerLimit) {
    const roleToTrim = [...roleOrder].reverse().find((role) => {
      if (role === 'mafia') return safeSettings.mafia > 1
      if (role === 'doctor') return safeSettings.doctors > 0
      if (role === 'detective') return safeSettings.detectives > 0
      return safeSettings.civilians > 0
    })

    if (!roleToTrim) break

    if (roleToTrim === 'mafia') safeSettings.mafia -= 1
    if (roleToTrim === 'doctor') safeSettings.doctors -= 1
    if (roleToTrim === 'detective') safeSettings.detectives -= 1
    if (roleToTrim === 'civilian') safeSettings.civilians -= 1
    total -= 1
  }

  return safeSettings
}

export function assignRandomRoles(players: Player[], settings: RoleSettings): Player[] {
  const deck = shuffle(buildRoleDeck(settings))

  return players.map((player, index) => ({
    ...player,
    role: deck[index] ?? 'civilian',
    alive: true,
    killedBy: undefined,
    deathReason: undefined,
    selfHealsUsed: 0
  }))
}

export function resetPlayersForGame(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    alive: true,
    killedBy: undefined,
    deathReason: undefined,
    selfHealsUsed: 0,
    score: 0
  }))
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = current
  }

  return result
}
