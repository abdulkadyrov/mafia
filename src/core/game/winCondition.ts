import type { DomainGamePlayer, GameWinner } from "./gameTypes";

export function getWinner(players: readonly DomainGamePlayer[]): GameWinner | null {
  const alive = players.filter((player) => player.lifeStatus === "alive" && player.team !== "host");
  if (alive.length === 0) return "draw";

  const aliveMafia = alive.filter((player) => player.team === "mafia").length;
  const aliveManiacs = alive.filter((player) => player.role === "maniac").length;
  const aliveOthers = alive.length - aliveMafia;

  if (aliveMafia === 0 && aliveManiacs === 0) return "city";
  if (aliveMafia > 0 && aliveMafia >= aliveOthers) return "mafia";
  if (aliveManiacs === 1 && alive.length === 1) return "maniac";
  return null;
}
