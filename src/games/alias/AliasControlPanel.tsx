import { Button } from "../../core/ui/Button";
import { Card } from "../../core/ui/Card";
import type { AliasRoundEntry, AliasState } from "./aliasTypes";

export function AliasControlPanel({
  state,
  onScoreToWinChange,
  onRoundTimeChange,
  onChoosePack,
  packOptions,
  onStart,
  onPause,
  onMarkCorrect,
  onSkip,
  onMistake,
  onNextTurn,
  onUpdateEntryResult,
  onRemoveEntry,
}: {
  state: AliasState;
  onScoreToWinChange: (value: AliasState["scoreToWin"]) => void;
  onRoundTimeChange: (value: AliasState["roundTimeSec"]) => void;
  onChoosePack: (packId: string) => void;
  packOptions: Array<{ id: string; title: string }>;
  onStart: () => void;
  onPause: () => void;
  onMarkCorrect: () => void;
  onSkip: () => void;
  onMistake: () => void;
  onNextTurn: () => void;
  onUpdateEntryResult: (entryId: string, result: AliasRoundEntry["result"]) => void;
  onRemoveEntry: (entryId: string) => void;
}) {
  return (
    <Card>
      <h3 className="text-xl font-black text-white">Панель ведущего</h3>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          value={state.selectedPackId ?? ""}
          onChange={(event) => onChoosePack(event.target.value)}
          className="h-11 rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
        >
          {packOptions.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.title}
            </option>
          ))}
        </select>

        <select
          value={state.scoreToWin}
          onChange={(event) =>
            onScoreToWinChange(Number(event.target.value) as AliasState["scoreToWin"])
          }
          className="h-11 rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
        >
          {[25, 50, 70, 100].map((value) => (
            <option key={value} value={value}>
              До {value} очков
            </option>
          ))}
        </select>

        <select
          value={state.roundTimeSec}
          onChange={(event) =>
            onRoundTimeChange(Number(event.target.value) as AliasState["roundTimeSec"])
          }
          className="h-11 rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
        >
          {[30, 60, 90, 120].map((value) => (
            <option key={value} value={value}>
              {value} сек
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="primary" onClick={onStart}>
          Старт
        </Button>
        <Button onClick={onPause}>Пауза</Button>
        <Button onClick={onMarkCorrect}>Правильно</Button>
        <Button onClick={onSkip}>Пропустить</Button>
        <Button onClick={onMistake}>Ошибка</Button>
        <Button onClick={onNextTurn}>Следующий ход</Button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Текущие ответы и пропуски
        </p>
        <div className="mt-3 space-y-2">
          {state.activeEntries.length === 0 ? (
            <p className="text-sm font-semibold text-white/60">
              Пока нет действий в текущем раунде.
            </p>
          ) : (
            state.activeEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-white/10 bg-[#04101d] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-white">{entry.wordText}</p>
                  <div className="flex flex-wrap gap-2">
                    {(["correct", "skip", "mistake"] as const).map((result) => (
                      <button
                        key={result}
                        type="button"
                        onClick={() => onUpdateEntryResult(entry.id, result)}
                        className={[
                          "rounded-full border px-2.5 py-1 text-xs font-black transition",
                          entry.result === result
                            ? "border-white bg-white text-zinc-950"
                            : "border-white/10 text-white/70 hover:bg-white/10",
                        ].join(" ")}
                      >
                        {result === "correct"
                          ? "Отгадали"
                          : result === "skip"
                          ? "Пропуск"
                          : "Ошибка"}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onRemoveEntry(entry.id)}
                      className="rounded-full border border-red-300/20 bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-100"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
