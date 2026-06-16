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

