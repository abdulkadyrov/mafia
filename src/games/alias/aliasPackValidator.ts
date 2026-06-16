import { safeJsonParse } from "../../utils/json";
import type { AliasPack } from "./aliasTypes";

export function validateAliasPack(input: string): {
  pack: AliasPack | null;
  errors: string[];
} {
  const parsed = safeJsonParse<Partial<AliasPack>>(input);

  if (!parsed) {
    return { pack: null, errors: ["Ошибка: JSON не удалось разобрать"] };
  }

  const errors: string[] = [];

  if (parsed.game !== "alias") {
    errors.push("Ошибка: game должен быть alias");
  }

  if (!Array.isArray(parsed.words)) {
    errors.push("Ошибка: words должен быть массивом");
  }

  return {
    pack: errors.length === 0 ? (parsed as AliasPack) : null,
    errors,
  };
}

