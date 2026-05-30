import React from "react";
import { motion } from "framer-motion";
import { defaultRoomSettings } from "../game/defaults";
import { useDeveloperMode } from "../hooks/useDeveloperMode";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { generateRoomCode, normalizeRoomCode } from "../network/RoomService";
import { Button } from "../shared/ui/Button";
import { RoomSettings } from "../types/game";

type Props = {
  onCreateRoom: (
    roomCode: string,
    settings: RoomSettings,
    developerMode: boolean,
    playerName: string
  ) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
};

export const Lobby: React.FC<Props> = ({ onCreateRoom, onJoinRoom }) => {
  const developerMode = useDeveloperMode();
  const [settings] = useLocalStorage<RoomSettings>(
    "mafia-room-settings",
    defaultRoomSettings
  );
  const [playerName, setPlayerName] = useLocalStorage("mafia-player-name", "");
  const [joinCode, setJoinCode] = React.useState("");

  const cleanName = playerName.trim();
  const cleanJoinCode = normalizeRoomCode(joinCode);
  const lanAddress = `${location.origin}/mafia/`;

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-5 text-zinc-950">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-5xl grid-rows-[auto_1fr_auto] gap-5">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <button
            type="button"
            onClick={developerMode.registerTap}
            className="text-left"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Mafia LAN
            </p>
            <h1 className="text-3xl font-black tracking-tight">Мафия</h1>
          </button>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-600">
            Wi-Fi / точка доступа
          </span>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid content-center gap-4 md:grid-cols-[1.05fr_0.95fr]"
        >
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
              disabled={!cleanName}
              onClick={() =>
                onCreateRoom(
                  generateRoomCode(),
                  settings,
                  developerMode.enabled,
                  cleanName
                )
              }
            >
              ▶ Создать комнату
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
              <Button
                disabled={!cleanName || cleanJoinCode.length !== 6}
                onClick={() => onJoinRoom(cleanJoinCode, cleanName)}
              >
                Войти
              </Button>
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5 text-white shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Локальная сеть
            </p>
            <h2 className="mt-4 text-2xl font-black">Играйте без интернета</h2>
            <div className="mt-5 space-y-3 text-sm font-semibold text-white/76">
              <p>1. Хост включает Wi-Fi или раздаёт точку доступа.</p>
              <p>2. Все игроки подключаются к этой же сети.</p>
              <p>
                3. Хост запускает npm run lan, игроки открывают адрес сервера и
                вводят код комнаты.
              </p>
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                Этот экран
              </p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-white">
                {lanAddress}
              </p>
            </div>
          </aside>
        </motion.section>

        <nav className="grid grid-cols-3 gap-2">
          <Button variant="ghost">Профиль</Button>
          <Button variant="ghost">История</Button>
          <Button variant="ghost">Настройки</Button>
        </nav>
      </div>
    </main>
  );
};
