import { routes } from "../core/config/routes";
import { gameRegistry } from "../core/games/gameRegistry";
import { AppLayout } from "../core/layout/AppLayout";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";

export function AppGamesPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  return (
    <AppLayout title="Игры" subtitle="Каждая игра запускается в своём сценарии">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {gameRegistry.map((game) => (
          <Card key={game.id}>
            <p className="text-3xl">{game.icon}</p>
            <h2 className="mt-4 text-2xl font-black text-white">{game.title}</h2>
            <p className="mt-3 text-sm font-semibold text-white/70">
              {game.description}
            </p>
            <div className="mt-5 flex gap-3">
              <Button onClick={() => navigate(routes.launch(game.id))}>
                Открыть
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
