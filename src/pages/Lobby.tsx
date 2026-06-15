import React from "react";
import { motion } from "framer-motion";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import { defaultRoomSettings } from "../game/defaults";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  createRoom,
  joinRoom,
  normalizeRoomCode,
} from "../services/roomService";
import { Button } from "../shared/ui/Button";
import { RoomSettings } from "../types/game";

type Props = {
  onOpenRoom: (roomCode: string) => void;
};

const ROOM_ID_STORAGE_KEY = "mafia_room_id";
const PLAYER_ID_STORAGE_KEY = "mafia_player_id";
const ROOM_CODE_STORAGE_KEY = "mafia_room_code";
const PLAYER_NAME_STORAGE_KEY = "mafia-player-name";

export const Lobby: React.FC<Props> = ({ onOpenRoom }) => {
  const [settings, setSettings] = useLocalStorage<RoomSettings>(
    "mafia-room-settings",
    defaultRoomSettings
  );
  const [playerName, setPlayerName] = useLocalStorage(
    PLAYER_NAME_STORAGE_KEY,
    ""
  );
  const [joinCode, setJoinCode] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [isCreatingRoom, setIsCreatingRoom] = React.useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = React.useState(false);

  const cleanName = playerName.trim();
  const cleanJoinCode = normalizeRoomCode(joinCode);

  async function handleCreateRoom() {
    if (!cleanName) {
      setErrorMessage("Введите имя");
      return;
    }

    setIsCreatingRoom(true);
    setErrorMessage("");

    try {
      const { room, host } = await createRoom(cleanName, settings);
      persistRoomSession(room.id, host.id, room.code, cleanName);
      onOpenRoom(room.code);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Ошибка создания комнаты"));
    } finally {
      setIsCreatingRoom(false);
    }
  }

  async function handleJoinRoom() {
    if (!cleanName) {
      setErrorMessage("Введите имя");
      return;
    }

    if (!cleanJoinCode) {
      setErrorMessage("Введите код комнаты");
      return;
    }

    setIsJoiningRoom(true);
    setErrorMessage("");

    try {
      const { room, player } = await joinRoom(cleanJoinCode, cleanName);
      persistRoomSession(room.id, player.id, room.code, cleanName);
      onOpenRoom(room.code);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Ошибка входа в комнату"));
    } finally {
      setIsJoiningRoom(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-5 text-zinc-950">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-6xl grid-rows-[auto_1fr] gap-5">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Mafia + Supabase
            </p>
            <h1 className="text-3xl font-black tracking-tight">Мафия</h1>
          </div>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-600">
            Realtime lobby
          </span>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid content-start gap-4 lg:grid-cols-[0.95fr_1.05fr]"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                Комната
              </p>
              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold text-zinc-600">
                  Имя
                </span>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Например, Тимур"
                  className="h-14 w-full rounded-lg border border-zinc-200 bg-white px-4 text-lg font-bold text-zinc-950 outline-none transition focus:border-zinc-950"
                />
              </label>

              <Button
                variant="primary"
                className="mt-4 h-14 w-full text-base"
                disabled={isCreatingRoom}
                onClick={handleCreateRoom}
              >
                {isCreatingRoom ? "Создание..." : "Создать комнату"}
              </Button>

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                <input
                  value={joinCode}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) =>
                    setJoinCode(normalizeRoomCode(event.target.value))
                  }
                  placeholder="483921"
                  className="h-14 min-w-0 rounded-lg border border-zinc-200 bg-white px-4 font-mono text-lg font-bold text-zinc-950 outline-none transition focus:border-zinc-950"
                />
                <Button disabled={isJoiningRoom} onClick={handleJoinRoom}>
                  {isJoiningRoom ? "Вход..." : "Войти"}
                </Button>
              </div>

              {errorMessage ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <aside className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5 text-white shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                Supabase
              </p>
              <h2 className="mt-4 text-2xl font-black">
                Комнаты и игроки хранятся в базе
              </h2>
              <div className="mt-5 space-y-3 text-sm font-semibold text-white/76">
                <p>1. Хост создаёт комнату и получает 6-значный код.</p>
                <p>2. Игроки входят по коду и сразу появляются в лобби.</p>
                <p>3. Лобби обновляется в realtime без ручной перезагрузки.</p>
              </div>
            </aside>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Настройки комнаты
            </p>
            <div className="mt-4">
              <RoomSettingsForm settings={settings} onChange={setSettings} />
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
};

function persistRoomSession(
  roomId: string,
  playerId: string,
  roomCode: string,
  playerName: string
) {
  window.localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
  window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, roomCode);
  window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
