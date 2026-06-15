import { motion } from "framer-motion";
import { useCountdown } from "../hooks/useCountdown";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { GameSnapshot, phaseLabels } from "../types/game";

type PhasePanelProps = {
  snapshot: GameSnapshot;
  onResolveNight: () => void;
  onDiscussion: () => void;
  onVoting: () => void;
  onResolveVotes: () => void;
  onNextNight: () => void;
};

export function PhasePanel({
  snapshot,
  onResolveNight,
  onDiscussion,
  onVoting,
  onResolveVotes,
  onNextNight,
}: PhasePanelProps) {
  const secondsLeft = useCountdown(snapshot.phaseEndsAt);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Panel className="overflow-hidden">
      <div className="relative">
        {snapshot.phase === "Night" ? (
          <motion.div
            className="absolute inset-0 rounded-xl bg-accent/10 blur-3xl"
            animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}

        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted">
              Раунд {snapshot.round || 0}
            </p>
            <h2 className="mt-1 text-3xl font-black text-text">
              {phaseLabels[snapshot.phase]}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {getPhaseHint(snapshot.phase)}
            </p>
          </div>

          <div className="grid h-28 w-28 place-items-center rounded-full border border-white/10 bg-background/80 shadow-inner">
            <span className="text-2xl font-black tabular-nums text-text">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          {snapshot.phase === "Night" ? (
            <Button onClick={onResolveNight}>Завершить ночь</Button>
          ) : null}
          {snapshot.phase === "NightResults" ? (
            <Button onClick={onDiscussion}>Перейти к обсуждению</Button>
          ) : null}
          {snapshot.phase === "Discussion" ? (
            <Button onClick={onVoting}>Начать голосование</Button>
          ) : null}
          {snapshot.phase === "Voting" ? (
            <Button onClick={onResolveVotes}>Подсчитать голоса</Button>
          ) : null}
          {snapshot.phase === "VoteResults" ? (
            <Button onClick={onNextNight}>Следующая ночь</Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function getPhaseHint(phase: GameSnapshot["phase"]): string {
  if (phase === "Lobby")
    return "Игроки подключаются, хост настраивает роли и запускает партию.";
  if (phase === "Night")
    return "Живые игроки видят только доступные их роли действия. Мирные ждут окончания ночи.";
  if (phase === "NightResults")
    return "Система применяет лечение, убийства и личные результаты детектива.";
  if (phase === "Discussion")
    return "Живые обсуждают подозрения. Мертвые остаются наблюдателями.";
  if (phase === "Voting")
    return "Каждый живой игрок выбирает цель и может поставить часть очков.";
  if (phase === "VoteResults")
    return "Итоги голосования сохранены в системной истории.";
  return "Партия завершена, роли раскрыты, очки подсчитаны.";
}
