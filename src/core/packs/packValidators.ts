import { validateAliasPack } from "../../games/alias/aliasPackValidator";
import { validateMillionairePack } from "../../games/millionaire/millionairePackValidator";
import type { SupportedPackGame } from "./packTypes";

export function validatePack(game: SupportedPackGame, json: string) {
  return game === "millionaire"
    ? validateMillionairePack(json)
    : validateAliasPack(json);
}

