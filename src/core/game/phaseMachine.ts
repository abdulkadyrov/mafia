import type { MafiaRole } from "../roles/roleTypes.ts";
import type { GamePhase } from "./gameTypes.ts";

const fixedTransitions: Partial<Record<GamePhase, readonly GamePhase[]>> = {
  lobby: ["role_reveal"],
  role_reveal: ["night_intro"],
  night_resolution: ["day_announcement", "game_over"],
  day_announcement: ["day_discussion"],
  day_discussion: ["day_voting"],
  day_voting: ["day_execution"],
  day_execution: ["night_intro", "game_over"],
  game_over: ["lobby", "role_reveal"],
};

export function getNextPhase(
  current: GamePhase,
  aliveRoles: readonly MafiaRole[] = []
): GamePhase | null {
  if (current === "night_intro") return "night_mafia";
  if (current === "night_mafia") {
    if (aliveRoles.some((role) => role === "doctor" || role === "bodyguard")) return "night_doctor";
    if (aliveRoles.includes("commissioner")) return "night_commissioner";
    return "night_resolution";
  }
  if (current === "night_doctor") {
    return aliveRoles.includes("commissioner") ? "night_commissioner" : "night_resolution";
  }
  if (current === "night_commissioner") return "night_resolution";
  return fixedTransitions[current]?.[0] ?? null;
}

export function canTransition(
  current: GamePhase,
  next: GamePhase,
  aliveRoles: readonly MafiaRole[] = []
): boolean {
  if (next === "game_over") {
    return current === "night_resolution" || current === "day_execution";
  }
  return getNextPhase(current, aliveRoles) === next;
}

export function assertTransition(
  current: GamePhase,
  next: GamePhase,
  aliveRoles: readonly MafiaRole[] = []
): void {
  if (!canTransition(current, next, aliveRoles)) {
    throw new Error(`Недопустимый переход фазы: ${current} → ${next}`);
  }
}
