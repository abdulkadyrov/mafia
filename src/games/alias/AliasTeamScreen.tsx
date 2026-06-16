import type { Team } from "../../core/teams/teamTypes";
import { AliasTimer } from "./AliasTimer";
import { AliasWordCard } from "./AliasWordCard";
import type { AliasState, AliasWord } from "./aliasTypes";

export function AliasTeamScreen({
  team,
  word,
  state,
}: {
  team: Team | null;
  word: AliasWord | null;
  state: AliasState;
}) {
  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <AliasWordCard word={word} />
      <div className="grid gap-4 overflow-auto pr-1">
        <AliasTimer seconds={state.remainingSeconds} />
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Команда
          </p>
          <h3 className="mt-3 text-2xl font-black text-white">
            {team?.name ?? "Команда не выбрана"}
          </h3>
          <p className="mt-3 text-sm font-semibold text-white/72">
            {state.phase === "running"
              ? "Сейчас идёт активный ход."
              : state.phase === "paused"
              ? "Раунд поставлен на паузу."
              : state.phase === "round_over"
              ? "Раунд завершён. Ждите следующий ход."
              : "Ведущий готовит следующий раунд."}
          </p>
        </div>
      </div>
    </div>
  );
}
