import { AppLayout } from "../core/layout/AppLayout";
import { GameHub } from "../core/games/GameHub";

export function GameHubPage({
  roomCode,
  navigate,
}: {
  roomCode: string;
  navigate: (path: string) => void;
}) {
  return (
    <AppLayout
      title="Выбор игры"
      subtitle="Игра выбирается только после входа в комнату"
    >
      <GameHub roomCode={roomCode} onNavigate={navigate} />
    </AppLayout>
  );
}

