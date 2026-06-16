import React from "react";
import { createHashAppPath } from "../shared/routing/basePath";
import { joinPlatformRoom, normalizeRoomCode } from "../core/room/roomService";
import { appConfig } from "../core/config/appConfig";
import { routes } from "../core/config/routes";
import { gameRegistry } from "../core/games/gameRegistry";
import { assignPlayerToTeam } from "../core/teams/teamService";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { Input } from "../core/ui/Input";
import { persistSession } from "../utils/storage";

export function GameJoinPage({
  gameId,
  roomCode,
  teamId,
}: {
  gameId: string;
  roomCode: string;
  teamId?: string;
}) {
  const [playerName, setPlayerName] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [isJoining, setIsJoining] = React.useState(false);
  const game = gameRegistry.find((item) => item.id === gameId);

  async function handleJoin() {
    const cleanRoomCode = normalizeRoomCode(roomCode);

    if (!game || !cleanRoomCode) {
      setErrorMessage("Некорректная ссылка приглашения");
      return;
    }

    if (!playerName.trim()) {
      setErrorMessage("Введите имя");
      return;
    }

    setIsJoining(true);
    setErrorMessage("");

    try {
      const { room, player } = await joinPlatformRoom(cleanRoomCode, playerName.trim());
      persistSession({
        roomId: room.id,
        roomCode: room.code,
        playerId: player.id,
        playerName: player.name,
      });

      if (teamId) {
        await assignPlayerToTeam({
          teamId,
          playerId: player.id,
        });
      }

      history.replaceState(null, "", createHashAppPath(routes.game(room.code, game.id)));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось подключиться к комнате"
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#16324f_0%,#07111f_40%,#020617_100%)] px-4 py-5 text-white">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] max-w-4xl gap-5">
        <Card className="self-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
            {appConfig.appName}
          </p>
          <h1 className="mt-4 text-4xl font-black">
            Вход в {game?.title ?? "игру"}
          </h1>
          <p className="mt-3 text-sm font-semibold text-white/72">
            QR-ссылка ведёт только в эту игру и эту комнату. Общий хаб здесь не
            показывается.
          </p>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-white/55">
              Имя игрока
            </span>
            <Input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Введите имя"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleJoin();
                }
              }}
            />
          </label>

          <div className="mt-5">
            <Button variant="primary" onClick={() => void handleJoin()}>
              {isJoining ? "Подключение..." : "Войти в комнату"}
            </Button>
          </div>

          {errorMessage ? (
            <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
              {errorMessage}
            </p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
