import type { AliasPack } from "./aliasTypes";

export function getInitialAliasWord(pack: AliasPack) {
  return pack.words[0] ?? null;
}

