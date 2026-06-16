import React from "react";
import { motion } from "framer-motion";
import { appConfig } from "../core/config/appConfig";
import { routes } from "../core/config/routes";
import { Card } from "../core/ui/Card";
import { Button } from "../core/ui/Button";
import { Input } from "../core/ui/Input";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { defaultRoomSettings } from "../game/defaults";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import {
  createPlatformRoom,
  joinPlatformRoom,
  normalizeRoomCode,
} from "../core/room/roomService";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../core/supabase/client";
import { persistSession } from "../utils/storage";
import type { RoomSettings } from "../types/game";

export function StartPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const [settings, setSettings] = useLocalStorage<RoomSettings>(
    "mafia-room-settings",
    defaultRoomSettings
  );
  const [playerName, setPlayerName] = useLocalStorage("mafia-player-name", "");
  const [joinCode, setJoinCode] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const cleanName = playerName.trim();
  const cleanJoinCode = normalizeRoomCode(joinCode);

  async function handleCreate() {
    if (!cleanName) {
      setErrorMessage("Введите имя игрока");
      return;
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const { room, host } = await createPlatformRoom(cleanName, settings);
      persistSession({
        roomId: room.id,
        roomCode: room.code,
        playerId: host.id,
        playerName: cleanName,
      });
      navigate(routes.room(room.code));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать комнату"
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoin() {
    if (!cleanName) {
      setErrorMessage("Введите имя игрока");
      return;
    }

    if (!cleanJoinCode) {
      setErrorMessage("Введите код комнаты");
      return;
    }

    setIsJoining(true);
    setErrorMessage("");

    try {
      const { room, player } = await joinPlatformRoom(cleanJoinCode, cleanName);
      persistSession({
        roomId: room.id,
        roomCode: room.code,
        playerId: player.id,
        playerName: cleanName,
      });
      navigate(routes.room(room.code));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось войти в комнату"
      );
    } finally {
      setIsJoining(false);
    }
  }

  const supabaseError = getSupabaseConfigError();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#16324f_0%,#07111f_40%,#020617_100%)] px-4 py-5 text-white">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] max-w-7xl gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
              {appConfig.appName}
            </p>
            <h1 className="mt-4 text-4xl font-black sm:text-5xl">
              Платформа для комнатных игр
            </h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/72">
              Сначала войдите в комнату, потом выбирайте игру: Mafia, Кто хочет
              стать миллионером или Alias.
            </p>
          </Card>

          <Card>
            <label className="block">
              <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-white/55">
                Имя игрока
              </span>
              <Input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Например, Тимур"
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeRoomCode(event.target.value))
                }
                placeholder="Код комнаты"
                inputMode="numeric"
                maxLength={6}
              />
              <Button
                disabled={isJoining || !isSupabaseConfigured()}
                onClick={() => void handleJoin()}
              >
                {isJoining ? "Вход..." : "Войти"}
              </Button>
            </div>

            <div className="mt-4">
              <Button
                variant="primary"
                disabled={isCreating || !isSupabaseConfigured()}
                onClick={() => void handleCreate()}
              >
                {isCreating ? "Создание..." : "Создать комнату"}
              </Button>
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                {errorMessage}
              </p>
            ) : null}

            {supabaseError ? (
              <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                Supabase не настроен. Заполните `VITE_SUPABASE_URL` и
                `VITE_SUPABASE_ANON_KEY`.
              </p>
            ) : null}
          </Card>
        </motion.section>

        <Card className="overflow-auto">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
            Стартовые настройки комнаты
          </p>
          <div className="mt-4">
            <RoomSettingsForm settings={settings} onChange={setSettings} />
          </div>
        </Card>
      </div>
    </main>
  );
}

