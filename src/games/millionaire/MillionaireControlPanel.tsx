import { Button } from "../../core/ui/Button";
import { Card } from "../../core/ui/Card";
import { Input } from "../../core/ui/Input";
import type { Team } from "../../core/teams/teamTypes";
import type { MillionaireQuestion, MillionaireState } from "./millionaireTypes";

export function MillionaireControlPanel({
  teams,
  state,
  question,
  selectedManualTeamId,
  manualDelta,
  onSelectedManualTeamIdChange,
  onManualDeltaChange,
  onChoosePack,
  packOptions,
  onStartQuestion,
  onShowOptions,
  onMarkCorrect,
  onMarkWrong,
  onReopen,
  onNextQuestion,
  onApplyManualScore,
  onEndGame,
}: {
  teams: Team[];
  state: MillionaireState;
  question: MillionaireQuestion | null;
  selectedManualTeamId: string;
  manualDelta: number;
  onSelectedManualTeamIdChange: (value: string) => void;
  onManualDeltaChange: (value: number) => void;
  onChoosePack: (packId: string) => void;
  packOptions: Array<{ id: string; title: string }>;
  onStartQuestion: () => void;
  onShowOptions: () => void;
  onMarkCorrect: () => void;
  onMarkWrong: () => void;
  onReopen: () => void;
  onNextQuestion: () => void;
  onApplyManualScore: () => void;
  onEndGame: () => void;
}) {
  return (
    <Card>
      <h3 className="text-xl font-black text-white">Панель ведущего</h3>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Пак вопросов
        </span>
        <select
          value={state.selectedPackId ?? ""}
          onChange={(event) => onChoosePack(event.target.value)}
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
        >
          {packOptions.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.title}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid gap-2">
        <Button variant="primary" onClick={onStartQuestion}>
          Начать вопрос
        </Button>
        <Button onClick={onShowOptions}>Показать варианты</Button>
        <Button onClick={onMarkCorrect} disabled={!state.buzzedTeamId || !question}>
          Ответ правильный
        </Button>
        <Button onClick={onMarkWrong} disabled={!state.buzzedTeamId || !question}>
          Ответ неправильный
        </Button>
        <Button onClick={onReopen}>Открыть вопрос снова</Button>
        <Button onClick={onNextQuestion}>Следующий вопрос</Button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
          Ручной счёт
        </p>
        <div className="mt-3 space-y-2">
          <select
            value={selectedManualTeamId}
            onChange={(event) => onSelectedManualTeamIdChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            value={String(manualDelta)}
            onChange={(event) => onManualDeltaChange(Number(event.target.value) || 0)}
            placeholder="Изменение очков"
          />
          <Button onClick={onApplyManualScore}>Применить</Button>
        </div>
      </div>

      <div className="mt-5">
        <Button variant="ghost" onClick={onEndGame}>
          Завершить игру
        </Button>
      </div>
    </Card>
  );
}
