import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { GameModule } from "./gameTypes";

export function GameCard({
  game,
  onPlay,
}: {
  game: GameModule;
  onPlay: (game: GameModule) => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl">{game.icon ?? "🎮"}</p>
          <h3 className="mt-4 text-2xl font-black text-white">{game.title}</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/72">
            {game.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/60">
        <span>{game.supportsTeams ? "Команды" : "Личные роли"}</span>
        <span>{game.supportsJsonPacks ? "JSON-паки" : "Без паков"}</span>
      </div>

      <div className="mt-6">
        <Button variant="primary" onClick={() => onPlay(game)}>
          Играть
        </Button>
      </div>
    </Card>
  );
}

