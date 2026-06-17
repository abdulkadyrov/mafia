import type { SupportedPackGame } from "./packTypes";

export type PackTemplateOptions = {
  theme: string;
  itemCount: number;
  title: string;
};

export function buildPackTemplate(
  game: SupportedPackGame,
  options: PackTemplateOptions
) {
  return JSON.stringify(
    game === "millionaire"
      ? createMillionaireTemplate(options)
      : createAliasTemplate(options),
    null,
    2
  );
}

export function buildPackPrompt(
  game: SupportedPackGame,
  options: PackTemplateOptions
) {
  return game === "millionaire"
    ? buildMillionairePrompt(options)
    : buildAliasPrompt(options);
}

function createMillionaireTemplate(options: PackTemplateOptions) {
  const previewCount = Math.min(options.itemCount, 2);

  return {
    game: "millionaire",
    title: options.title,
    description: `Пак на тему "${options.theme}"`,
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      allowImages: true,
    },
    questions: Array.from({ length: previewCount }, (_, index) => ({
      id: `q${index + 1}`,
      level: index + 1,
      points: (index + 1) * 100,
      question: `Вопрос ${index + 1} на тему "${options.theme}"`,
      image: null,
      options: [
        { id: "a", text: "Вариант A" },
        { id: "b", text: "Вариант B" },
        { id: "c", text: "Вариант C" },
        { id: "d", text: "Вариант D" },
      ],
      correctOptionId: "a",
      explanation: "Короткое объяснение правильного ответа.",
    })),
  };
}

function createAliasTemplate(options: PackTemplateOptions) {
  const previewCount = Math.min(options.itemCount, 2);

  return {
    game: "alias",
    title: options.title,
    description: `Набор слов на тему "${options.theme}"`,
    settings: {
      roundTimeSec: 60,
      pointsCorrect: 1,
      pointsMistake: -1,
      allowSkip: true,
      shuffleWords: true,
    },
    words: Array.from({ length: previewCount }, (_, index) => ({
      id: `w${index + 1}`,
      text: `Слово ${index + 1}`,
      difficulty: "medium",
      category: options.theme,
    })),
  };
}

function buildMillionairePrompt(options: PackTemplateOptions) {
  return [
    `Сделай JSON-пак для игры "Кто хочет стать миллионером" на тему "${options.theme}".`,
    `Нужно ровно ${options.itemCount} вопросов.`,
    `Верни только валидный JSON без markdown, без пояснений и без лишнего текста.`,
    `Сохрани структуру и ключи точно как в шаблоне ниже.`,
    `У каждого вопроса должны быть question, 4 варианта ответа, correctOptionId, explanation, level, points.`,
    `correctOptionId должен быть одним из: "a", "b", "c", "d".`,
    `Тема универсальная: можно использовать любой поджанр внутри темы, но все вопросы должны ей соответствовать.`,
    `Ниже прикреплен шаблон, строго следуй ему:`,
  ].join("\n");
}

function buildAliasPrompt(options: PackTemplateOptions) {
  return [
    `Сделай JSON-пак для игры "Alias" на тему "${options.theme}".`,
    `Нужно ровно ${options.itemCount} слов или словосочетаний.`,
    `Верни только валидный JSON без markdown, без пояснений и без лишнего текста.`,
    `Сохрани структуру и ключи точно как в шаблоне ниже.`,
    `Для каждого слова укажи text, difficulty и category.`,
    `Тема универсальная: можно использовать любые подкатегории внутри темы, но все слова должны ей соответствовать.`,
    `Ниже прикреплен шаблон, строго следуй ему:`,
  ].join("\n");
}
