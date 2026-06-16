export type AliasWord = {
  id: string;
  text: string;
  difficulty: string;
  category: string;
};

export type AliasPack = {
  game: "alias";
  title: string;
  description: string;
  settings: {
    roundTimeSec: number;
    pointsCorrect: number;
    pointsMistake: number;
    allowSkip: boolean;
    shuffleWords: boolean;
  };
  words: AliasWord[];
};

export type AliasEntryResult = "correct" | "skip" | "mistake";

export type AliasRoundEntry = {
  id: string;
  teamId: string;
  wordId: string;
  wordText: string;
  result: AliasEntryResult;
  createdAt: string;
};

export type AliasRoundHistory = {
  id: string;
  teamId: string;
  entries: AliasRoundEntry[];
  createdAt: string;
};

export type AliasState = {
  selectedPackId: string | null;
  phase: "setup" | "running" | "paused" | "round_over" | "finished";
  scoreToWin: 25 | 50 | 70 | 100;
  roundTimeSec: 30 | 60 | 90 | 120;
  currentTeamIndex: number;
  currentWordIndex: number;
  roundEndsAt: string | null;
  remainingSeconds: number;
  activeEntries: AliasRoundEntry[];
  rounds: AliasRoundHistory[];
  winnerTeamId: string | null;
};
