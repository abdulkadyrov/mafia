import type { MafiaRole, MafiaTeam } from "../roles/roleTypes";

export type BotMindPlayer = {
  id: string;
  role: MafiaRole;
  team: MafiaTeam;
  lifeStatus: "alive" | "dead" | "disconnected";
  isModerator: boolean;
};

export type BotMindContext = {
  pressureByTarget?: Readonly<Record<string, number>>;
  previousTargetIds?: readonly string[];
  checkedPlayerIds?: readonly string[];
  knownMafiaIds?: readonly string[];
};

export function chooseMediumBotNightTarget(
  actor: BotMindPlayer,
  players: readonly BotMindPlayer[],
  context: BotMindContext = {},
  random: () => number = Math.random
): BotMindPlayer | null {
  const alive = players.filter((player) => player.lifeStatus === "alive" && !player.isModerator);
  let candidates = alive.filter((player) => player.id !== actor.id);
  if (actor.role === "doctor") candidates = alive;
  if (actor.team === "mafia") candidates = candidates.filter((player) => player.team !== "mafia");
  if (actor.role === "commissioner") {
    const checked = new Set(context.checkedPlayerIds ?? []);
    const unchecked = candidates.filter((player) => !checked.has(player.id));
    if (unchecked.length > 0) candidates = unchecked;
  }
  candidates = avoidPreviousTargetWhenPossible(candidates, context.previousTargetIds);
  return weightedChoice(candidates, context.pressureByTarget, random);
}

export function chooseMediumBotVote(
  actor: BotMindPlayer,
  players: readonly BotMindPlayer[],
  context: BotMindContext = {},
  random: () => number = Math.random
): BotMindPlayer | null {
  let candidates = players.filter((player) =>
    player.lifeStatus === "alive" && !player.isModerator && player.id !== actor.id
  );
  const knownMafia = new Set(context.knownMafiaIds ?? []);
  const confirmed = candidates.filter((player) => knownMafia.has(player.id));
  if (actor.role === "commissioner" && confirmed.length > 0) return weightedChoice(confirmed, context.pressureByTarget, random);
  if (actor.team === "mafia") {
    const opponents = candidates.filter((player) => player.team !== "mafia");
    if (opponents.length > 0 && random() < 0.88) candidates = opponents;
  }
  return weightedChoice(candidates, context.pressureByTarget, random);
}

export function mediumBotDiscussionLine(actorName: string, targetName: string | null, random: () => number = Math.random): string {
  if (!targetName) return "Пока мало информации. Послушаю остальных.";
  const lines = [
    `Я бы присмотрелся к игроку ${targetName}.`,
    `${targetName} пока вызывает у меня вопросы.`,
    `Не уверен, но мой главный подозреваемый сейчас — ${targetName}.`,
    `${actorName}: предлагаю внимательнее проверить ${targetName}.`,
  ];
  return lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))];
}

function avoidPreviousTargetWhenPossible(
  candidates: BotMindPlayer[],
  previousTargetIds: readonly string[] | undefined
): BotMindPlayer[] {
  const previous = new Set(previousTargetIds ?? []);
  const fresh = candidates.filter((candidate) => !previous.has(candidate.id));
  return fresh.length > 0 ? fresh : candidates;
}

function weightedChoice(
  candidates: readonly BotMindPlayer[],
  pressureByTarget: Readonly<Record<string, number>> | undefined,
  random: () => number
): BotMindPlayer | null {
  let selected: BotMindPlayer | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const pressure = Math.max(0, Number(pressureByTarget?.[candidate.id] ?? 0));
    const score = pressure * 0.42 + random();
    if (score > bestScore) {
      selected = candidate;
      bestScore = score;
    }
  }
  return selected;
}
