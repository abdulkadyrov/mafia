import type { Team } from "../../core/teams/teamTypes";
import type {
  AliasEntryResult,
  AliasPack,
  AliasRoundEntry,
  AliasState,
} from "./aliasTypes";

export function createInitialAliasState(): AliasState {
  return {
    setupStep: "teams",
    selectedPackId: null,
    phase: "setup",
    scoreToWin: 25,
    roundTimeSec: 60,
    currentTeamIndex: 0,
    currentWordIndex: 0,
    roundEndsAt: null,
    remainingSeconds: 60,
    activeEntries: [],
    rounds: [],
    winnerTeamId: null,
  };
}

export function getCurrentAliasWord(pack: AliasPack, state: AliasState) {
  return pack.words[state.currentWordIndex % Math.max(pack.words.length, 1)] ?? null;
}

export function buildAliasEntry(input: {
  teamId: string;
  wordId: string;
  wordText: string;
  result: AliasEntryResult;
}): AliasRoundEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    teamId: input.teamId,
    wordId: input.wordId,
    wordText: input.wordText,
    result: input.result,
    createdAt: new Date().toISOString(),
  };
}

export function computeAliasScores(
  teams: Team[],
  state: AliasState,
  settings: Pick<AliasPack["settings"], "pointsCorrect" | "pointsMistake">
) {
  const scores = teams.reduce<Record<string, number>>((accumulator, team) => {
    accumulator[team.id] = 0;
    return accumulator;
  }, {});

  const allEntries = [
    ...state.rounds.flatMap((round) => round.entries),
    ...state.activeEntries,
  ];

  for (const entry of allEntries) {
    if (entry.result === "correct") {
      scores[entry.teamId] = (scores[entry.teamId] ?? 0) + settings.pointsCorrect;
    }

    if (entry.result === "mistake") {
      scores[entry.teamId] = (scores[entry.teamId] ?? 0) + settings.pointsMistake;
    }
  }

  return scores;
}

export function getAliasWinnerTeamId(
  teams: Team[],
  scores: Record<string, number>,
  scoreToWin: number
) {
  const rankedTeams = teams
    .map((team) => ({
      id: team.id,
      score: scores[team.id] ?? 0,
    }))
    .sort((left, right) => right.score - left.score);

  const leader = rankedTeams[0];
  const runnerUp = rankedTeams[1];

  if (!leader || leader.score < scoreToWin) {
    return null;
  }

  if (runnerUp && runnerUp.score === leader.score) {
    return null;
  }

  return leader.id;
}
