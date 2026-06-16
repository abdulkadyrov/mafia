import { routes } from "../config/routes";
import { GameCard } from "./GameCard";
import { gameRegistry } from "./gameRegistry";
import type { GameModule } from "./gameTypes";

export function GameHub({
  roomCode,
  onNavigate,
}: {
  roomCode: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {gameRegistry.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onPlay={(selectedGame: GameModule) =>
            onNavigate(routes.game(roomCode, selectedGame.id))
          }
        />
      ))}
    </div>
  );
}

