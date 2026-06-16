import { ScoreBoard } from "../../core/score/ScoreBoard";
import type { Team } from "../../core/teams/teamTypes";
import { MillionaireAnswerGrid } from "./MillionaireAnswerGrid";
import { MillionaireControlPanel } from "./MillionaireControlPanel";
import { MillionaireQuestionView } from "./MillionaireQuestionView";
import type { MillionaireQuestion, MillionaireState } from "./millionaireTypes";

export function MillionaireHostScreen({
  teams,
  state,
  question,
  questionNumber,
  questionCount,
  prizeLabel,
  guaranteeLabel,
  timerLabel,
  visibleAnswerCount,
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
  questionNumber: number;
  questionCount: number;
  prizeLabel: string;
  guaranteeLabel: string;
  timerLabel: string;
  visibleAnswerCount: number;
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
  const buzzedTeam = teams.find((team) => team.id === state.buzzedTeamId) ?? null;

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.12fr_0.88fr]">
      <div className="space-y-4 overflow-auto pr-1">
        <div className="millionaire-circle-wrap">
          <div className="millionaire-circle">
            <div className="millionaire-circle-time">{timerLabel}</div>
            <div className="millionaire-circle-sub">сек</div>
          </div>
        </div>
        <MillionaireQuestionView
          question={question}
          questionNumber={questionNumber}
          questionCount={questionCount}
          prizeLabel={prizeLabel}
          guaranteeLabel={guaranteeLabel}
          timerLabel={timerLabel}
        />
        {state.showOptions || visibleAnswerCount > 0 ? (
          <MillionaireAnswerGrid question={question} visibleCount={visibleAnswerCount} />
        ) : (
          <div className="millionaire-panel text-sm font-semibold text-white/70">
            Варианты ответа пока скрыты.
          </div>
        )}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Состояние вопроса
          </p>
          <div className="mt-3 space-y-2 text-sm font-semibold text-white/80">
            <p>Фаза: {state.phase}</p>
            <p>Нажала первой: {buzzedTeam?.name ?? "Пока никто"}</p>
            <p>
              Уже ошиблись:{" "}
              {teams
                .filter((team) => state.wrongTeamIds.includes(team.id))
                .map((team) => team.name)
                .join(", ") || "Никто"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 overflow-auto pr-1">
        <ScoreBoard teams={teams} />
        <MillionaireControlPanel
          teams={teams}
          state={state}
          question={question}
          selectedManualTeamId={selectedManualTeamId}
          manualDelta={manualDelta}
          onSelectedManualTeamIdChange={onSelectedManualTeamIdChange}
          onManualDeltaChange={onManualDeltaChange}
          onChoosePack={onChoosePack}
          packOptions={packOptions}
          onStartQuestion={onStartQuestion}
          onShowOptions={onShowOptions}
          onMarkCorrect={onMarkCorrect}
          onMarkWrong={onMarkWrong}
          onReopen={onReopen}
          onNextQuestion={onNextQuestion}
          onApplyManualScore={onApplyManualScore}
          onEndGame={onEndGame}
        />
      </div>
    </div>
  );
}
