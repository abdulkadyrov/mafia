import React from "react";
import { AppLayout } from "../core/layout/AppLayout";
import { routes } from "../core/config/routes";
import { usePlayer } from "../core/player/usePlayer";
import { useRoom } from "../core/room/useRoom";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { Badge } from "../core/ui/Badge";
import { clearSession } from "../utils/storage";

export function RoomLobbyPage({
  roomCode,
  navigate,
}: {
  roomCode: string;
  navigate: (path: string) => void;
}) {
  const { room, players, isLoading } = useRoom();
  const { currentPlayer } = usePlayer();

  if (isLoading) {
    return <AppLayout title="Лобби комнаты">Загрузка комнаты...</AppLayout>;
  }

  if (!room) {
    return (
      <AppLayout title="Лобби комнаты">
        <Card>Комната не найдена.</Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Лобби комнаты"
      subtitle={`Код ${roomCode}`}
      actions={
        <>
          <Button onClick={() => navigate(routes.games(roomCode))}>Игры</Button>
          <Button variant="ghost" onClick={() => navigate(routes.settings(roomCode))}>
            Настройки
          </Button>
          <Button variant="ghost" onClick={() => navigate(routes.import(roomCode))}>
            Импорт
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearSession();
              navigate(routes.home);
            }}
          >
            Выйти
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Card className="min-h-[32rem]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Abdulkadyrov Games</Badge>
            <Badge className="border-sky-300/25 bg-sky-400/10 text-sky-100">
              Игрок: {currentPlayer?.name ?? "Гость"}
            </Badge>
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">
            Игроки комнаты
          </h2>
          <div className="mt-4 space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-sm font-black text-white">
                  {player.name}
                  {player.id === currentPlayer?.id ? " (Вы)" : ""}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/55">
                  {player.is_host ? "Хост" : "Игрок"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
