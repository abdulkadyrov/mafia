import { ScoreBoard } from "../../core/score/ScoreBoard";
import type { Team } from "../../core/teams/teamTypes";
import { AliasControlPanel } from "./AliasControlPanel";
import { AliasTimer } from "./AliasTimer";
import { AliasWordCard } from "./AliasWordCard";
import type { AliasState, AliasWord } from "./aliasTypes";

export function AliasHostScreen({
  teams,
  scores,
  currentTeam,
  word,
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
  teams: Team[];
  scores: Record<string, number>;
  currentTeam: Team | null;
  word: AliasWord | null;
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
  onUpdateEntryResult: (entryId: string, result: AliasState["activeEntries"][number]["result"]) => void;
  onRemoveEntry: (entryId: string) => void;
}) {
  const scoreTeams = teams.map((team) => ({
    ...team,
    score: scores[team.id] ?? 0,
  }));

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4 overflow-auto pr-1">
        <AliasWordCard word={word} />
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/80">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Ход
          </p>
          <p className="mt-3 text-2xl font-black text-white">
            {currentTeam?.name ?? "Команда не выбрана"}
          </p>
          <p className="mt-2 text-sm font-semibold">
            Фаза: {state.phase} · До {state.scoreToWin} очков
          </p>
        </div>
      </div>

      <div className="grid gap-4 overflow-auto pr-1">
        <AliasTimer seconds={state.remainingSeconds} />
        <ScoreBoard teams={scoreTeams} />
        <AliasControlPanel
          state={state}
          onScoreToWinChange={onScoreToWinChange}
          onRoundTimeChange={onRoundTimeChange}
          onChoosePack={onChoosePack}
          packOptions={packOptions}
          onStart={onStart}
          onPause={onPause}
          onMarkCorrect={onMarkCorrect}
          onSkip={onSkip}
          onMistake={onMistake}
          onNextTurn={onNextTurn}
          onUpdateEntryResult={onUpdateEntryResult}
          onRemoveEntry={onRemoveEntry}
        />
      </div>
    </div>
  );
}
