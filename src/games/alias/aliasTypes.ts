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

