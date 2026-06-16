import type { MillionairePack } from "./millionaireTypes";

export function getInitialMillionaireQuestion(pack: MillionairePack) {
  return pack.questions[0] ?? null;
}

