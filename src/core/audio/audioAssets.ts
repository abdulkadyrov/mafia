export const audioAssets = {
  bgGame: new URL("../../../audio/bg_game.mp3", import.meta.url).toString(),
  bgAudience: new URL(
    "../../../audio/bg_audience.mp3",
    import.meta.url
  ).toString(),
  clockTick: new URL(
    "../../../audio/clock_tick.mp3",
    import.meta.url
  ).toString(),
  intro: new URL("../../../audio/intro.mp3", import.meta.url).toString(),
  firstQuestion: new URL(
    "../../../audio/first_question.mp3",
    import.meta.url
  ).toString(),
  lockIn: new URL("../../../audio/lock_in.mp3", import.meta.url).toString(),
  answerLocked: new URL(
    "../../../audio/answer_locked.mp3",
    import.meta.url
  ).toString(),
  correctHard: new URL(
    "../../../audio/correct_hard.mp3",
    import.meta.url
  ).toString(),
  wrong: new URL("../../../audio/wrong.mp3", import.meta.url).toString(),
  nextQuestion: new URL(
    "../../../audio/next_question.mp3",
    import.meta.url
  ).toString(),
} as const;

export type AudioAssetKey = keyof typeof audioAssets;

