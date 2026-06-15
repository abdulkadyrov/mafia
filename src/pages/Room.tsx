import React from "react";
import { motion } from "framer-motion";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import { addGameEvent } from "../services/gameService";
import { getPlayers } from "../services/playerService";
import { updatePlayerRole } from "../services/playerService";
import {
  getRoomByCode,
  normalizeRoomCode,
  updateRoomPhase,
  updateRoomSettings,
} from "../services/roomService";
import {
  subscribeToPlayers,
  subscribeToRoom,
  unsubscribe,
} from "../services/realtimeService";
import { Button } from "../shared/ui/Button";
import type { Player, PlayerRole, Room as RoomRecord } from "../types/database";
import type { RoomSettings } from "../types/game";

type Props = {
  onLeave: () => void;
  roomCode: string;
};

const PLAYER_ID_STORAGE_KEY = "mafia_player_id";
const ROOM_ID_STORAGE_KEY = "mafia_room_id";
const ROOM_CODE_STORAGE_KEY = "mafia_room_code";

export const Room: React.FC<Props> = ({ onLeave, roomCode }) => {
  const [room, setRoom] = React.useState<RoomRecord | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isStartingGame, setIsStartingGame] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const normalizedRoomCode = React.useMemo(
    () => normalizeRoomCode(roomCode),
    [roomCode]
  );
  const localPlayerId = React.useMemo(
    () => window.localStorage.getItem(PLAYER_ID_STORAGE_KEY),
    []
  );

  const loadRoomData = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setErrorMessage("");

      try {
        const nextRoom = await getRoomByCode(normalizedRoomCode);

        if (!nextRoom) {
          setRoom(null);
          setPlayers([]);
          setErrorMessage("Комната не найдена");
          return;
        }

        const nextPlayers = await getPlayers(nextRoom.id);
        setRoom(nextRoom);
        setPlayers(nextPlayers);
        window.localStorage.setItem(ROOM_ID_STORAGE_KEY, nextRoom.id);
        window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, nextRoom.code);
      } catch (error) {
        setErrorMessage(
          getErrorMessage(error, "Не удалось подключиться к Supabase")
        );
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [normalizedRoomCode]
  );

  React.useEffect(() => {
    void loadRoomData();
  }, [loadRoomData]);

  React.useEffect(() => {
    if (!room?.id) {
      return undefined;
    }

    const roomChannel = subscribeToRoom(room.id, (payload) => {
      if (payload.new) {
        setRoom(payload.new as RoomRecord);
      }

      void loadRoomData({ silent: true });
    });
    const playersChannel = subscribeToPlayers(room.id, (payload) => {
      applyPlayersRealtimePayload(payload);
      void loadRoomData({ silent: true });
    });

    return () => {
      unsubscribe(roomChannel);
      unsubscribe(playersChannel);
    };
  }, [loadRoomData, room?.id]);

  React.useEffect(() => {
    if (!room?.id || room.phase !== "lobby") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadRoomData({ silent: true });
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadRoomData, room?.id, room?.phase]);

  const selfPlayer =
    players.find((player) => player.id === localPlayerId) ?? null;
  const isHost =
    Boolean(selfPlayer?.is_host) || room?.host_player_id === localPlayerId;

  async function handleStartGame() {
    if (!room) {
      return;
    }

    if (players.length < 4) {
      setErrorMessage("Для старта игры нужно минимум 4 игрока");
      return;
    }

    setIsStartingGame(true);
    setErrorMessage("");

    try {
      const assignedRoles = buildRoleAssignments(players, room.settings);

      await Promise.all(
        assignedRoles.map((player) => updatePlayerRole(player.id, player.role))
      );

      await addGameEvent(room.id, {
        round_number: 1,
        phase: "night",
        type: "game_started",
        message: "Игра началась. Роли назначены, наступает ночь.",
        visibility: "public",
        target_player_id: null,
      });

      await updateRoomPhase(room.id, "night", { roundNumber: 1 });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Не удалось обновить фазу комнаты")
      );
    } finally {
      setIsStartingGame(false);
    }
  }

  async function handleSettingsChange(nextSettings: RoomSettings) {
    if (!room || !isHost) {
      return;
    }

    setIsSavingSettings(true);
    setErrorMessage("");

    try {
      await updateRoomSettings(room.id, nextSettings);
      setRoom({
        ...room,
        settings: nextSettings,
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Не удалось обновить настройки комнаты")
      );
    } finally {
      setIsSavingSettings(false);
    }
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-5 text-zinc-950">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500">
            Загрузка
          </p>
          <h1 className="mt-3 text-2xl font-black">
            Подключаем комнату {normalizedRoomCode}
          </h1>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-5 text-zinc-950">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500">
            Комната
          </p>
          <h1 className="mt-3 text-2xl font-black">
            {errorMessage || "Комната не найдена"}
          </h1>
          <Button className="mt-5 w-full" variant="primary" onClick={onLeave}>
            Назад
          </Button>
        </div>
      </main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-[#f7f7f5] px-4 py-5 text-zinc-950"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Лобби
            </p>
            <h1 className="font-mono text-3xl font-black tracking-[0.14em]">
              {room.code}
            </h1>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              Фаза: {formatPhase(room.phase)} · Игроков: {players.length}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isHost ? (
              <Button
                variant="primary"
                disabled={isStartingGame}
                onClick={handleStartGame}
              >
                {isStartingGame ? "Запуск..." : "Начать игру"}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onLeave}>
              Выйти
            </Button>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!selfPlayer ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            Игрок не найден в комнате. Вернитесь назад и войдите заново по коду.
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  Игроки
                </p>
                <h2 className="mt-2 text-2xl font-black">Список комнаты</h2>
              </div>
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold text-zinc-600">
                realtime
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={[
                    "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-4 py-3",
                    player.id === localPlayerId
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-950",
                  ].join(" ")}
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-sm font-black text-zinc-950">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{player.name}</p>
                    <p
                      className={[
                        "text-xs font-semibold",
                        player.id === localPlayerId
                          ? "text-white/70"
                          : "text-zinc-500",
                      ].join(" ")}
                    >
                      {player.is_host ? "Хост" : "Игрок"} ·{" "}
                      {player.is_alive ? "В игре" : "Выбыл"}
                    </p>
                  </div>
                  <div
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold",
                      player.id === localPlayerId
                        ? "bg-white/10 text-white"
                        : "bg-white text-zinc-600",
                    ].join(" ")}
                  >
                    {player.score} очк.
                  </div>
                </div>
              ))}
            </div>
          </div>

          {room.phase === "lobby" ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    Настройки
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Параметры комнаты
                  </h2>
                </div>
                {isHost ? (
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold text-zinc-600">
                    {isSavingSettings ? "Сохранение..." : "Хост может менять"}
                  </div>
                ) : null}
              </div>

              <div
                className={
                  isHost ? "mt-4" : "mt-4 pointer-events-none opacity-75"
                }
              >
                <RoomSettingsForm
                  settings={room.settings as RoomSettings}
                  onChange={(nextSettings) => {
                    void handleSettingsChange(nextSettings);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                Игра
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Раунд {room.round_number || 1} · {formatPhase(room.phase)}
              </h2>

              {selfPlayer ? (
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    Ваша роль
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {formatRole(selfPlayer.role)}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-500">
                    {getRoleDescription(selfPlayer.role)}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatusCard
                  label="Живых игроков"
                  value={String(
                    players.filter((player) => player.is_alive).length
                  )}
                />
                <StatusCard
                  label="Всего игроков"
                  value={String(players.length)}
                />
              </div>

              {isHost ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      void updateRoomPhase(room.id, getNextPhase(room.phase), {
                        roundNumber:
                          room.phase === "voting"
                            ? room.round_number + 1
                            : room.round_number,
                      });
                    }}
                  >
                    Следующая фаза
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void updateRoomPhase(room.id, "game_over");
                    }}
                  >
                    Завершить игру
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </motion.main>
  );

  function applyPlayersRealtimePayload(
    payload: RealtimePostgresChangesPayload<Player>
  ) {
    if (payload.eventType === "INSERT" && payload.new) {
      setPlayers((currentPlayers) => {
        const nextPlayer = payload.new as Player;

        if (currentPlayers.some((player) => player.id === nextPlayer.id)) {
          return currentPlayers;
        }

        return [...currentPlayers, nextPlayer].sort(
          (left, right) =>
            new Date(left.joined_at).getTime() -
            new Date(right.joined_at).getTime()
        );
      });
      return;
    }

    if (payload.eventType === "UPDATE" && payload.new) {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === payload.new.id ? (payload.new as Player) : player
        )
      );
      return;
    }

    if (payload.eventType === "DELETE" && payload.old?.id) {
      setPlayers((currentPlayers) =>
        currentPlayers.filter((player) => player.id !== payload.old.id)
      );
    }
  }
};

function formatPhase(phase: RoomRecord["phase"]): string {
  switch (phase) {
    case "lobby":
      return "Лобби";
    case "night":
      return "Ночь";
    case "day":
      return "День";
    case "voting":
      return "Голосование";
    case "voting_confirmation":
      return "Подтверждение голосования";
    case "game_over":
      return "Конец игры";
    default:
      return phase;
  }
}

function buildRoleAssignments(
  players: Player[],
  settings: RoomRecord["settings"]
): Array<{ id: string; role: PlayerRole }> {
  const deck = buildRoleDeck(players.length, settings);
  const shuffledRoles = shuffle(deck);
  const shuffledPlayers = shuffle(players);

  return shuffledPlayers.map((player, index) => ({
    id: player.id,
    role: shuffledRoles[index] ?? "civilian",
  }));
}

function buildRoleDeck(
  playerCount: number,
  settings: RoomRecord["settings"]
): PlayerRole[] {
  const deck: PlayerRole[] = [];

  for (let index = 0; index < settings.roles.mafia; index += 1) {
    deck.push("mafia");
  }

  for (let index = 0; index < settings.roles.doctors; index += 1) {
    deck.push("doctor");
  }

  for (let index = 0; index < settings.roles.detectives; index += 1) {
    deck.push("inspector");
  }

  while (deck.length < playerCount) {
    deck.push("civilian");
  }

  return deck.slice(0, playerCount);
}

function shuffle<T>(items: T[]): T[] {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentValue = nextItems[index];
    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = currentValue;
  }

  return nextItems;
}

function formatRole(role: PlayerRole): string {
  switch (role) {
    case "mafia":
      return "Мафия";
    case "doctor":
      return "Доктор";
    case "inspector":
      return "Инспектор";
    case "civilian":
      return "Мирный";
    default:
      return "Не назначена";
  }
}

function getRoleDescription(role: PlayerRole): string {
  switch (role) {
    case "mafia":
      return "Ночью выберите цель вместе с другими мафиози.";
    case "doctor":
      return "Ночью спасайте одного игрока от выбывания.";
    case "inspector":
      return "Ночью проверяйте игроков и ищите мафию.";
    case "civilian":
      return "Днём обсуждайте и голосуйте против подозреваемых.";
    default:
      return "Роль будет выдана при старте игры.";
  }
}

function getNextPhase(currentPhase: RoomRecord["phase"]): RoomRecord["phase"] {
  switch (currentPhase) {
    case "night":
      return "day";
    case "day":
      return "voting";
    case "voting":
      return "night";
    case "voting_confirmation":
      return "night";
    case "game_over":
      return "game_over";
    default:
      return "night";
  }
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
