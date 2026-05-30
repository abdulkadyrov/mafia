import { PlayerRow } from "../entities/player/PlayerRow";
import { Panel } from "../shared/ui/Panel";
import { GameSnapshot } from "../types/game";

type GameOverPanelProps = {
  snapshot: GameSnapshot;
};

export function GameOverPanel({ snapshot }: GameOverPanelProps) {
  const mvp = snapshot.players.find(
    (player) => player.id === snapshot.mvpPlayerId
  );

  if (snapshot.phase !== "GameOver") {
    return null;
  }

  return (
    <Panel className="border-zinc-950 bg-zinc-950 text-white">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-white/50">
        Конец игры
      </p>
      <h2 className="mt-2 text-3xl font-black text-white">
        🏆 Победа {snapshot.winner === "mafia" ? "мафии" : "мирных жителей"}
      </h2>
      {mvp ? (
        <p className="mt-2 text-sm font-bold text-white/65">MVP: {mvp.name}</p>
      ) : null}
      <div className="mt-5 grid gap-2">
        {snapshot.players.map((player) => (
          <PlayerRow key={player.id} player={player} revealRole />
        ))}
      </div>
    </Panel>
  );
}
