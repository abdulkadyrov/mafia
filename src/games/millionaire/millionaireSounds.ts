import { audioAssets } from "../../core/audio/audioAssets";

export const millionaireSounds = {
  intro: audioAssets.intro,
  firstQuestion: audioAssets.firstQuestion,
  clockTick: audioAssets.clockTick,
  lockIn: audioAssets.lockIn,
  answerLocked: audioAssets.answerLocked,
  bgAudience: audioAssets.bgAudience,
  correctHard: audioAssets.correctHard,
  wrong: audioAssets.wrong,
  nextQuestion: audioAssets.nextQuestion,
} as const;
