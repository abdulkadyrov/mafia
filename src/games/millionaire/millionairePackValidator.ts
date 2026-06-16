import { safeJsonParse } from "../../utils/json";
import type { MillionairePack } from "./millionaireTypes";

export function validateMillionairePack(input: string): {
  pack: MillionairePack | null;
  errors: string[];
} {
  const parsed = safeJsonParse<Partial<MillionairePack>>(input);

  if (!parsed) {
    return { pack: null, errors: ["Ошибка: JSON не удалось разобрать"] };
  }

  const errors: string[] = [];

  if (parsed.game !== "millionaire") {
    errors.push("Ошибка: game должен быть millionaire");
  }

  if (!Array.isArray(parsed.questions)) {
    errors.push("Ошибка: questions должен быть массивом");
  } else {
    parsed.questions.forEach((question, index) => {
      const questionId = question?.id ?? `q${index + 1}`;

      if (!question?.correctOptionId) {
        errors.push(`Ошибка: у вопроса ${questionId} нет correctOptionId`);
      }

      if (!Array.isArray(question?.options) || question.options.length < 4) {
        errors.push(
          `Ошибка: у вопроса ${questionId} меньше 4 вариантов ответа`
        );
      }

      if (
        question?.image !== null &&
        typeof question?.image !== "undefined" &&
        typeof question?.image !== "string"
      ) {
        errors.push("Ошибка: image должен быть null или строкой");
      }
    });
  }

  return {
    pack: errors.length === 0 ? (parsed as MillionairePack) : null,
    errors,
  };
}

