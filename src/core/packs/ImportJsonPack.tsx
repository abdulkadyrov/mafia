import React from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Tabs } from "../ui/Tabs";
import { saveGamePack } from "./packService";
import { validatePack } from "./packValidators";
import type { SupportedPackGame } from "./packTypes";

export function ImportJsonPack({
  roomId,
}: {
  roomId: string;
}) {
  const [game, setGame] = React.useState<SupportedPackGame>("millionaire");
  const [json, setJson] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);

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

    await saveGamePack({
      roomId,
      gameType: game,
      title: validation.pack.title,
      content: validation.pack,
    });
    setStatus("Пак сохранён.");
  }

  return (
    <Card>
      <Tabs
        value={game}
        onChange={setGame}
        items={[
          { value: "millionaire", label: "Millionaire" },
          { value: "alias", label: "Alias" },
        ]}
      />
      <textarea
        value={json}
        onChange={(event) => setJson(event.target.value)}
        placeholder="Вставьте JSON пакета"
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
          Проверить и сохранить
        </Button>
      </div>
    </Card>
  );
}
