export type MillionaireOption = {
  id: string;
  text: string;
};

export type MillionaireQuestion = {
  id: string;
  level: number;
  points: number;
  question: string;
  image: string | null;
  options: MillionaireOption[];
  correctOptionId: string;
  explanation: string;
};

export type MillionairePack = {
  game: "millionaire";
  title: string;
  description: string;
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    allowImages: boolean;
  };
  questions: MillionaireQuestion[];
};

