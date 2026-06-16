import { gameRegistry } from "./gameRegistry";

export function GameShell({
  roomCode,
  gameId,
}: {
  roomCode: string;
  gameId: string;
}) {
  const game = gameRegistry.find((item) => item.id === gameId);

  if (!game) {
    return (
      <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-6 text-red-100">
        Игра не найдена.
      </div>
    );
  }

  const Component = game.component;
  return <Component roomCode={roomCode} />;
}

