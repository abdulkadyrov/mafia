import React from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Tabs } from "../ui/Tabs";
import { getGamePacksByType, type GamePackRecord } from "../games/gameStateService";
import { subscribeToGamePacks, unsubscribe } from "../supabase/realtime";
import { saveGamePack } from "./packService";
import { buildPackPrompt, buildPackTemplate } from "./packTemplates";
import { validatePack } from "./packValidators";
import type { SupportedPackGame } from "./packTypes";

export function ImportJsonPack({
  roomId,
  initialGame,
}: {
  roomId: string;
  initialGame?: SupportedPackGame;
}) {
  const [game, setGame] = React.useState<SupportedPackGame>(
    initialGame ?? "millionaire"
  );
  const [packName, setPackName] = React.useState("Новая тема");
  const [theme, setTheme] = React.useState("Общая тема");
  const [itemCount, setItemCount] = React.useState(20);
  const [json, setJson] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);
  const [packs, setPacks] = React.useState<GamePackRecord[]>([]);
  const [packsLoading, setPacksLoading] = React.useState(true);
  const template = React.useMemo(
    () =>
      buildPackTemplate(game, {
        theme,
        itemCount,
        title: packName || "Новая тема",
      }),
    [game, itemCount, packName, theme]
  );
  const prompt = React.useMemo(
    () =>
      `${buildPackPrompt(game, {
        theme,
        itemCount,
        title: packName || "Новая тема",
      })}\n\n${template}`,
    [game, itemCount, packName, template, theme]
  );

  React.useEffect(() => {
    if (initialGame) {
      setGame(initialGame);
    }
  }, [initialGame]);

  React.useEffect(() => {
    setPackName(game === "millionaire" ? "Новая викторина" : "Новый словарь");
    setTheme(game === "millionaire" ? "Школьные знания" : "Общие слова");
    setItemCount(game === "millionaire" ? 20 : 50);
    setJson("");
    setErrors([]);
    setStatus("");
  }, [game]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadPacks() {
      setPacksLoading(true);

      try {
        const nextPacks = await getGamePacksByType(roomId, game);

        if (isMounted) {
          setPacks(nextPacks);
        }
      } finally {
        if (isMounted) {
          setPacksLoading(false);
        }
      }
    }

    void loadPacks();
    const channel = subscribeToGamePacks(roomId, () => {
      void loadPacks();
    });

    return () => {
      isMounted = false;
      unsubscribe(channel);
    };
  }, [game, roomId]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    setJson(text);
    setStatus(`Файл ${file.name} загружен.`);
  }

  async function handleSave() {
    const validation = validatePack(game, json);
    setErrors(validation.errors);

    if (!validation.pack) {
      return;
    }

    const packTitle = packName.trim() || validation.pack.title;
    const normalizedPack = {
      ...validation.pack,
      title: packTitle,
      description:
        "description" in validation.pack && validation.pack.description
          ? validation.pack.description
          : `Пак на тему "${theme}"`,
    };

    await saveGamePack({
      roomId,
      gameType: game,
      title: packTitle,
      content: normalizedPack,
    });
    setStatus("Пак сохранён.");
    setJson("");
  }

  return (
    <Card>
      {!initialGame ? (
        <Tabs
          value={game}
          onChange={setGame}
          items={[
            { value: "millionaire", label: "Millionaire" },
            { value: "alias", label: "Alias" },
          ]}
        />
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Имя темы
          </span>
          <input
            value={packName}
            onChange={(event) => setPackName(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Тема
          </span>
          <input
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
            {game === "millionaire" ? "Количество вопросов" : "Количество слов"}
          </span>
          <input
            type="number"
            min={game === "millionaire" ? 5 : 10}
            max={200}
            value={itemCount}
            onChange={(event) => setItemCount(Math.max(1, Number(event.target.value) || 1))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
              Промпт для нейросети
            </p>
            <Button
              className="min-h-10 px-3 py-2"
              onClick={() => {
                void navigator.clipboard.writeText(prompt);
                setStatus("Промпт скопирован.");
              }}
            >
              Копировать промпт
            </Button>
          </div>
          <textarea
            value={prompt}
            readOnly
            className="min-h-[18rem] w-full rounded-2xl border border-white/10 bg-[#020b16] px-4 py-4 text-sm font-semibold text-white outline-none"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
              Шаблон JSON
            </p>
            <Button
              className="min-h-10 px-3 py-2"
              onClick={() => {
                void navigator.clipboard.writeText(template);
                setStatus("Шаблон скопирован.");
              }}
            >
              Копировать шаблон
            </Button>
          </div>
          <textarea
            value={template}
            readOnly
            className="min-h-[18rem] w-full rounded-2xl border border-white/10 bg-[#020b16] px-4 py-4 text-sm font-semibold text-white outline-none"
          />
        </div>
      </div>

      <textarea
        value={json}
        onChange={(event) => setJson(event.target.value)}
        placeholder="Вставьте сюда JSON, который вернула нейросеть"
        className="mt-4 min-h-[18rem] w-full rounded-2xl border border-white/10 bg-[#020b16] px-4 py-4 text-sm font-semibold text-white outline-none"
      />
      <label className="mt-4 inline-flex cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10">
        Загрузить .json файл
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(event) => {
            void handleFileUpload(event);
          }}
        />
      </label>
      {errors.length > 0 ? (
        <div className="mt-4 space-y-2 text-sm font-semibold text-red-200">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {status ? (
        <p className="mt-4 text-sm font-semibold text-emerald-200">{status}</p>
      ) : null}
      <div className="mt-4">
        <Button variant="primary" onClick={() => void handleSave()}>
          Сохранить
        </Button>
      </div>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Сохранённые темы
        </p>
        <div className="mt-3 space-y-3">
          {packsLoading ? (
            <p className="text-sm font-semibold text-white/60">Загрузка тем...</p>
          ) : packs.length === 0 ? (
            <p className="text-sm font-semibold text-white/60">
              Пока нет сохранённых тем для этой игры.
            </p>
          ) : (
            packs
              .slice()
              .reverse()
              .map((pack) => {
                const content = pack.content as {
                  description?: string;
                  questions?: unknown[];
                  words?: unknown[];
                };
                const itemCountLabel =
                  game === "millionaire"
                    ? `Вопросов: ${content.questions?.length ?? 0}`
                    : `Слов: ${content.words?.length ?? 0}`;

                return (
                  <div
                    key={pack.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <p className="text-lg font-black text-white">{pack.title}</p>
                    <p className="mt-2 text-sm font-semibold text-white/70">
                      {content.description ?? "Без описания"}
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                      {itemCountLabel}
                    </p>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </Card>
  );
}
