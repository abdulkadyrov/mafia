import { Button } from "../../core/ui/Button";
import { Card } from "../../core/ui/Card";
import type { Team } from "../../core/teams/teamTypes";
import { MillionaireAnswerGrid } from "./MillionaireAnswerGrid";
import { MillionaireQuestionView } from "./MillionaireQuestionView";
import type { MillionaireQuestion, MillionaireState } from "./millionaireTypes";

export function MillionaireTeamScreen({
  team,
  question,
  state,
  questionNumber,
  questionCount,
  prizeLabel,
  guaranteeLabel,
  timerLabel,
  visibleAnswerCount,
  canBuzz,
  onBuzz,
}: {
  team: Team | null;
  question: MillionaireQuestion | null;
  state: MillionaireState;
  questionNumber: number;
  questionCount: number;
  prizeLabel: string;
  guaranteeLabel: string;
  timerLabel: string;
  visibleAnswerCount: number;
  canBuzz: boolean;
  onBuzz: () => void;
}) {
  const statusText = !team
    ? "Сначала ведущий должен назначить вас в команду."
    : state.buzzedTeamId === team.id
    ? "Вы нажали первыми."
    : state.wrongTeamIds.includes(team.id)
    ? "Вы уже ошиблись в этом вопросе."
    : state.buzzedTeamId
    ? "Другая команда нажала первой."
    : state.phase === "question"
    ? "Можно отвечать."
    : "Ждите следующего вопроса.";

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.05fr_0.95fr]">
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
          <div className="millionaire-panel text-white/72">Варианты ответа пока скрыты.</div>
        )}
      </div>
      <div className="grid gap-4 overflow-auto pr-1">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Ваша команда
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">
            {team?.name ?? "Команда не выбрана"}
          </h3>
          <p className="mt-3 text-sm font-semibold text-white/72">{statusText}</p>
          <div className="mt-5">
            <Button variant="primary" disabled={!canBuzz} onClick={onBuzz}>
              Ответить
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
