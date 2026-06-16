import React from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { Button } from "../ui/Button";
import { buildPackPrompt, buildPackTemplate } from "./packTemplates";
import {
  getLocalGamePacksByType,
  removeLocalGamePack,
  saveLocalGamePack,
  type LocalGamePackRecord,
} from "./localPackLibrary";
import { validatePack } from "./packValidators";
import type { SupportedPackGame } from "./packTypes";

export function LocalPackManager({
  game,
}: {
  game: SupportedPackGame;
}) {
  const [libraryVersion, setLibraryVersion] = useLocalStorage(
    `ag_local_pack_library_version_${game}`,
    0
  );
  const [editingPackId, setEditingPackId] = React.useState<string | null>(null);
  const [packName, setPackName] = React.useState("");
  const [theme, setTheme] = React.useState("");
  const [itemCount, setItemCount] = React.useState(20);
  const [json, setJson] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);

  const packs = React.useMemo(
    () => getLocalGamePacksByType(game).slice().reverse(),
    [game, libraryVersion]
  );
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
    resetForm();
  }, [game]);

  function resetForm() {
    setEditingPackId(null);
    setPackName(game === "millionaire" ? "Новая викторина" : "Новый словарь");
    setTheme(game === "millionaire" ? "Школьные знания" : "Общие слова");
    setItemCount(game === "millionaire" ? 20 : 50);
    setJson("");
    setErrors([]);
    setStatus("");
  }

  function syncLibrary() {
    setLibraryVersion((currentVersion) => currentVersion + 1);
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

    saveLocalGamePack({
      id: editingPackId ?? undefined,
      gameType: game,
      title: packTitle,
      content: normalizedPack,
    });
    syncLibrary();
    setStatus(editingPackId ? "Шаблон обновлён." : "Шаблон сохранён.");
    setEditingPackId(null);
    setJson("");
  }

  function handleEdit(pack: LocalGamePackRecord) {
    const content = pack.content as {
      title?: string;
      description?: string;
      questions?: unknown[];
      words?: unknown[];
    };

    setEditingPackId(pack.id);
    setPackName(pack.title);
    setTheme(content.description ?? pack.title);
    setItemCount(
      game === "millionaire"
        ? content.questions?.length ?? 20
        : content.words?.length ?? 50
    );
    setJson(JSON.stringify(pack.content, null, 2));
    setErrors([]);
    setStatus("Режим редактирования включён.");
  }

  function handleDelete(packId: string) {
    removeLocalGamePack(packId);
    syncLibrary();
    if (editingPackId === packId) {
      resetForm();
    }
    setStatus("Шаблон удалён.");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
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
            onChange={(event) =>
              setItemCount(Math.max(1, Number(event.target.value) || 1))
            }
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
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
        className="min-h-[18rem] w-full rounded-2xl border border-white/10 bg-[#020b16] px-4 py-4 text-sm font-semibold text-white outline-none"
      />

      {errors.length > 0 ? (
        <div className="space-y-2 text-sm font-semibold text-red-200">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {status ? (
        <p className="text-sm font-semibold text-emerald-200">{status}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => void handleSave()}>
          {editingPackId ? "Сохранить изменения" : "Сохранить шаблон"}
        </Button>
        <Button variant="ghost" onClick={resetForm}>
          Новый шаблон
        </Button>
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Сохранённые шаблоны
        </p>
        <div className="mt-3 space-y-3">
          {packs.length === 0 ? (
            <p className="text-sm font-semibold text-white/60">
              Пока нет сохранённых шаблонов для этой игры.
            </p>
          ) : (
            packs.map((pack) => {
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">{pack.title}</p>
                      <p className="mt-2 text-sm font-semibold text-white/70">
                        {content.description ?? "Без описания"}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                        {itemCountLabel}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="min-h-10 px-3 py-2"
                        onClick={() => handleEdit(pack)}
                      >
                        Изменить
                      </Button>
                      <Button
                        className="min-h-10 px-3 py-2"
                        variant="ghost"
                        onClick={() => handleDelete(pack.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
