import React from "react";
import { AppLayout } from "../core/layout/AppLayout";
import { routes } from "../core/config/routes";
import { usePlayer } from "../core/player/usePlayer";
import { useRoom } from "../core/room/useRoom";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { Badge } from "../core/ui/Badge";
import { addGameEvent } from "../services/gameService";
import { clearSession } from "../utils/storage";
import { safeJsonParse } from "../utils/json";
import { formatDateTime } from "../utils/time";

type LobbyChatMessage = {
  authorId: string;
  authorName: string;
  text: string;
};

export function RoomLobbyPage({
  roomCode,
  navigate,
}: {
  roomCode: string;
  navigate: (path: string) => void;
}) {
  const { room, players, events, isLoading } = useRoom();
  const { currentPlayer } = usePlayer();
  const [draft, setDraft] = React.useState("");

  const chatMessages = events
    .filter((event) => event.type === "chat_message")
    .map((event) => {
      const payload = safeJsonParse<LobbyChatMessage>(event.message);
      return payload
        ? { ...payload, id: event.id, createdAt: event.created_at }
        : null;
    })
    .filter(
      (
        item
      ): item is LobbyChatMessage & { id: string; createdAt: string } =>
        Boolean(item)
    );

  async function handleSendChat() {
    if (!room || !currentPlayer || !draft.trim()) {
      return;
    }

    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: room.phase,
      type: "chat_message",
      message: JSON.stringify({
        authorId: currentPlayer.id,
        authorName: currentPlayer.name,
        text: draft.trim(),
      }),
      visibility: "public",
      target_player_id: null,
    });
    setDraft("");
  }

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
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
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

        <Card className="flex min-h-[32rem] flex-col">
          <h2 className="text-2xl font-black text-white">Чат комнаты</h2>
          <div className="mt-4 flex-1 space-y-3 overflow-auto">
            {chatMessages.map((message) => (
              <article
                key={message.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-emerald-200">
                    {message.authorName}
                  </p>
                  <span className="text-xs font-semibold text-white/40">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white/82">
                  {message.text}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Написать сообщение"
              className="h-12 flex-1 rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
            />
            <Button variant="primary" onClick={() => void handleSendChat()}>
              Отправить
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

