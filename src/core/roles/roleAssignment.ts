import { roleRegistry } from "./roleRegistry.ts";
import type { MafiaRole, RoleCounts } from "./roleTypes.ts";

export type RoleAssignment = {
  playerId: string;
  role: MafiaRole;
  team: ReturnType<typeof getTeam>;
};

export function buildRoleDeck(counts: RoleCounts, playerCount: number): MafiaRole[] {
  if (!Number.isInteger(playerCount) || playerCount < 4) {
    throw new Error("Для партии требуется минимум 4 игрока");
  }

  const deck: MafiaRole[] = [];
  const order: MafiaRole[] = [
    "don",
    "mafia",
    "doctor",
    "commissioner",
    "maniac",
    "mistress",
    "bodyguard",
    "host",
    "civilian",
  ];

  for (const role of order) {
    const rawCount = counts[role] ?? 0;
    if (!Number.isInteger(rawCount) || rawCount < 0) {
      throw new Error(`Некорректное количество роли ${role}`);
    }
    for (let index = 0; index < rawCount; index += 1) deck.push(role);
  }

  const mafiaCount = deck.filter((role) => role === "mafia" || role === "don").length;
  if (mafiaCount < 1) throw new Error("В партии должна быть хотя бы одна мафия");
  if (mafiaCount >= Math.ceil(playerCount / 2)) {
    throw new Error("Мафия должна быть в меньшинстве в начале партии");
  }
  if (deck.length > playerCount) throw new Error("Ролей больше, чем игроков");

  while (deck.length < playerCount) deck.push("civilian");
  return deck;
}

export function assignRoles(
  playerIds: readonly string[],
  counts: RoleCounts,
  random: () => number = Math.random
): RoleAssignment[] {
  const deck = secureShuffle(buildRoleDeck(counts, playerIds.length), random);
  return playerIds.map((playerId, index) => ({
    playerId,
    role: deck[index],
    team: getTeam(deck[index]),
  }));
}

export function secureShuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getTeam(role: MafiaRole) {
  return roleRegistry[role].team;
}
