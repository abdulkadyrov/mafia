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

export type MillionaireQuestionResult = {
  questionId: string;
  teamId: string;
  result: "correct" | "wrong";
  createdAt: string;
};

export type MillionaireState = {
  setupMode: "teams" | "single";
  setupStep: "teams" | "pack" | "play";
  selectedPackId: string | null;
  questionIndex: number;
  phase: "setup" | "question" | "buzzed" | "resolved" | "finished";
  showOptions: boolean;
  buzzedTeamId: string | null;
  wrongTeamIds: string[];
  results: MillionaireQuestionResult[];
  lastCorrectTeamId: string | null;
};
