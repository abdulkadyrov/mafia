import React from "react";
import { motion } from "framer-motion";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import { useCountdown } from "../hooks/useCountdown";
import {
  addGameEvent,
  addNightAction,
  getDoctorSelfHealCount,
  getNightActions,
} from "../services/gameService";
import {
  getPlayers,
  killPlayer,
  updatePlayerRole,
} from "../services/playerService";
import {
  getRoomByCode,
  normalizeRoomCode,
  updateRoomPhase,
  updateRoomSettings,
} from "../services/roomService";
import {
  subscribeToNightActions,
  subscribeToPlayers,
  subscribeToRoom,
  unsubscribe,
} from "../services/realtimeService";
import { Button } from "../shared/ui/Button";
import type {
  NightAction,
  Player,
  PlayerRole,
  Room as RoomRecord,
} from "../types/database";
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
  const [nightActions, setNightActions] = React.useState<NightAction[]>([]);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isStartingGame, setIsStartingGame] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(
    null
  );
  const [isPlayersExpanded, setIsPlayersExpanded] = React.useState(true);
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

      try {
        const nextRoom = await getRoomByCode(normalizedRoomCode);

        if (!nextRoom) {
          setRoom(null);
          setPlayers([]);
          setNightActions([]);
          setErrorMessage("Комната не найдена");
          return;
        }

        const [nextPlayers, nextNightActions] = await Promise.all([
          getPlayers(nextRoom.id),
          nextRoom.phase === "lobby"
            ? Promise.resolve([])
            : getNightActions(nextRoom.id, nextRoom.round_number || 1),
        ]);

        setRoom(nextRoom);
        setPlayers(nextPlayers);
        setNightActions(nextNightActions);
        setErrorMessage("");
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
    const nightActionsChannel = subscribeToNightActions(room.id, (payload) => {
      applyNightActionRealtimePayload(payload);
      void loadRoomData({ silent: true });
    });

    return () => {
      unsubscribe(roomChannel);
      unsubscribe(playersChannel);
      unsubscribe(nightActionsChannel);
    };
  }, [loadRoomData, room?.id]);

  React.useEffect(() => {
    if (!room?.id || room.phase === "lobby") {
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
  const isNightPhase = room?.phase === "night";
  const phaseEndsAt = room ? getPhaseEndsAt(room) : undefined;
  const secondsLeft = useCountdown(phaseEndsAt);
  const orderedPlayers = React.useMemo(
    () => orderPlayers(players, localPlayerId),
    [players, localPlayerId]
  );
  const selectedPlayer =
    orderedPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const aliveMafia = players.filter(
    (player) => player.is_alive && player.role === "mafia"
  );
  const myNightActions = nightActions.filter(
    (action) => action.actor_player_id === localPlayerId
  );
  const otherMafiaAction =
    selfPlayer?.role === "mafia"
      ? nightActions.find(
          (action) =>
            action.action_type === "mafiaKill" &&
            action.actor_player_id !== localPlayerId &&
            aliveMafia.some(
              (mafiaPlayer) => mafiaPlayer.id === action.actor_player_id
            )
        )
      : undefined;
  const otherMafiaTargetName = otherMafiaAction
    ? players.find((player) => player.id === otherMafiaAction.target_player_id)
        ?.name ?? "игрок"
    : null;

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
    setActionMessage("");

    try {
      const assignedRoles = buildRoleAssignments(players, room.settings);

      await Promise.all(
        assignedRoles.map((player) => updatePlayerRole(player.id, player.role))
      );

      await addGameEvent(room.id, {
        round_number: 1,
        phase: "night",
        type: "game_started",
        message: "Игра началась. Наступает ночь.",
        visibility: "public",
        target_player_id: null,
      });

      await updateRoomPhase(room.id, "night", { roundNumber: 1 });
      setActionMessage("Игра началась. Проверьте свою роль.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось начать игру"));
    } finally {
      setIsStartingGame(false);
    }
  }

  async function handleSettingsChange(nextSettings: RoomSettings) {
    if (!room || !isHost || room.phase !== "lobby") {
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

  async function handleAdvancePhase() {
    if (!room || !isHost) {
      return;
    }

    setErrorMessage("");
    setActionMessage("");

    try {
      if (room.phase === "night") {
        await resolveNightPhase(room, players, nightActions);
      }

      const nextPhase = getNextPhase(room.phase);
      const nextRoundNumber =
        room.phase === "day" ? room.round_number + 1 : room.round_number;

      if (nextPhase === "day") {
        await addGameEvent(room.id, {
          round_number: room.round_number,
          phase: "day",
          type: "phase_changed",
          message: "Наступил день.",
          visibility: "public",
          target_player_id: null,
        });
      }

      if (nextPhase === "night") {
        await addGameEvent(room.id, {
          round_number: nextRoundNumber,
          phase: "night",
          type: "phase_changed",
          message: "Наступила новая ночь.",
          visibility: "public",
          target_player_id: null,
        });
      }

      await updateRoomPhase(room.id, nextPhase, {
        roundNumber: nextRoundNumber,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось переключить фазу"));
    }
  }

  async function handleEndGame() {
    if (!room || !isHost) {
      return;
    }

    try {
      await updateRoomPhase(room.id, "game_over");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось завершить игру"));
    }
  }

  async function handleRoleAction(actionType: NightAction["action_type"]) {
    if (
      !room ||
      !selfPlayer ||
      !selectedPlayer ||
      room.phase !== "night" ||
      !selfPlayer.is_alive
    ) {
      return;
    }

    setIsSubmittingAction(true);
    setErrorMessage("");
    setActionMessage("");

    try {
      if (actionType === "doctorHeal" && selectedPlayer.id === selfPlayer.id) {
        const selfHealCount = await getDoctorSelfHealCount(
          room.id,
          selfPlayer.id
        );

        if (selfHealCount >= room.settings.doctorSelfHealsLimit) {
          throw new Error("Доктор уже использовал самолечение");
        }
      }

      await addNightAction(room.id, {
        round_number: room.round_number || 1,
        actor_player_id: selfPlayer.id,
        target_player_id: selectedPlayer.id,
        action_type: actionType,
      });

      if (actionType === "detectiveCheck") {
        setActionMessage(
          `${selectedPlayer.name}: ${formatRole(selectedPlayer.role)}`
        );
      } else if (actionType === "detectiveKill") {
        setActionMessage(`Инспектор выбрал цель: ${selectedPlayer.name}`);
      } else if (actionType === "doctorHeal") {
        setActionMessage(`Доктор спасает: ${selectedPlayer.name}`);
      } else if (actionType === "mafiaKill") {
        setActionMessage(`Мафия выбрала цель: ${selectedPlayer.name}`);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось сохранить действие"));
    } finally {
      setIsSubmittingAction(false);
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
      animate={{
        background:
          room.phase === "night"
            ? "linear-gradient(180deg, #020617 0%, #000000 100%)"
            : "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
      }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className={[
        "min-h-screen px-4 py-5",
        room.phase === "night" ? "text-white" : "text-zinc-950",
      ].join(" ")}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4">
        <header
          className={[
            "flex flex-wrap items-center justify-between gap-3 border-b pb-4",
            room.phase === "night" ? "border-white/10" : "border-zinc-200",
          ].join(" ")}
        >
          <div>
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.18em]",
                room.phase === "night" ? "text-white/60" : "text-zinc-500",
              ].join(" ")}
            >
              Комната
            </p>
            <h1 className="font-mono text-3xl font-black tracking-[0.14em]">
              {room.code}
            </h1>
            <p
              className={[
                "mt-1 text-sm font-semibold",
                room.phase === "night" ? "text-white/65" : "text-zinc-500",
              ].join(" ")}
            >
              Игроков: {players.length}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {room.phase === "lobby" && isHost ? (
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

        {room.phase !== "lobby" ? (
          <section className="grid place-items-center gap-2 py-1 text-center">
            <p
              className={[
                "text-sm font-black uppercase tracking-[0.28em]",
                room.phase === "night" ? "text-white/60" : "text-zinc-500",
              ].join(" ")}
            >
              {getPhaseEmoji(room.phase)} {formatPhase(room.phase)}
            </p>
            <p className="mt-2 font-mono text-6xl font-black tracking-[0.26em] sm:text-7xl">
              {formatTimer(secondsLeft)}
            </p>
            {selfPlayer ? (
              <p
                className={[
                  "rounded-full px-4 py-1 text-sm font-black uppercase tracking-[0.18em]",
                  room.phase === "night"
                    ? "bg-white/10 text-white"
                    : "bg-zinc-100 text-zinc-700",
                ].join(" ")}
              >
                {formatRole(selfPlayer.role)}
              </p>
            ) : null}
          </section>
        ) : null}

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

        {room.phase === "lobby" ? (
          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <PlayersPanel
              players={orderedPlayers}
              localPlayerId={localPlayerId}
              isExpanded={isPlayersExpanded}
              onToggle={() => setIsPlayersExpanded((current) => !current)}
              onSelectPlayer={setSelectedPlayerId}
              selectedPlayerId={selectedPlayerId}
              phase={room.phase}
              selfPlayer={selfPlayer}
              onSubmitAction={handleRoleAction}
              isSubmittingAction={isSubmittingAction}
              otherMafiaTargetName={otherMafiaTargetName}
              myNightActions={myNightActions}
              actionMessage={actionMessage}
            />

            {isHost ? (
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
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold text-zinc-600">
                    {isSavingSettings ? "Сохранение..." : "Только хост"}
                  </div>
                </div>

                <div className="mt-4">
                  <RoomSettingsForm
                    settings={room.settings as RoomSettings}
                    onChange={(nextSettings) => {
                      void handleSettingsChange(nextSettings);
                    }}
                  />
                </div>
              </div>
            ) : (
              <WaitingPanel />
            )}
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <PlayersPanel
              players={orderedPlayers}
              localPlayerId={localPlayerId}
              isExpanded={isPlayersExpanded}
              onToggle={() => setIsPlayersExpanded((current) => !current)}
              onSelectPlayer={setSelectedPlayerId}
              selectedPlayerId={selectedPlayerId}
              phase={room.phase}
              selfPlayer={selfPlayer}
              onSubmitAction={handleRoleAction}
              isSubmittingAction={isSubmittingAction}
              otherMafiaTargetName={otherMafiaTargetName}
              myNightActions={myNightActions}
              actionMessage={actionMessage}
            />

            <div className="grid gap-4">
              {isHost ? (
                <HostControls
                  phase={room.phase}
                  roundNumber={room.round_number}
                  onAdvancePhase={() => {
                    void handleAdvancePhase();
                  }}
                  onEndGame={() => {
                    void handleEndGame();
                  }}
                />
              ) : null}
            </div>
          </section>
        )}
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

        return orderPlayers([...currentPlayers, nextPlayer], localPlayerId);
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

  function applyNightActionRealtimePayload(
    payload: RealtimePostgresChangesPayload<NightAction>
  ) {
    if (payload.eventType === "INSERT" && payload.new) {
      setNightActions((currentActions) => {
        const nextAction = payload.new as NightAction;

        if (currentActions.some((action) => action.id === nextAction.id)) {
          return currentActions;
        }

        return [...currentActions, nextAction];
      });
      return;
    }

    if (payload.eventType === "UPDATE" && payload.new) {
      setNightActions((currentActions) =>
        currentActions.map((action) =>
          action.id === payload.new.id ? (payload.new as NightAction) : action
        )
      );
      return;
    }

    if (payload.eventType === "DELETE" && payload.old?.id) {
      setNightActions((currentActions) =>
        currentActions.filter((action) => action.id !== payload.old.id)
      );
    }
  }
};

function PlayersPanel({
  players,
  localPlayerId,
  isExpanded,
  onToggle,
  onSelectPlayer,
  selectedPlayerId,
  phase,
  selfPlayer,
  onSubmitAction,
  isSubmittingAction,
  otherMafiaTargetName,
  myNightActions,
  actionMessage,
}: {
  players: Player[];
  localPlayerId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectPlayer: (playerId: string) => void;
  selectedPlayerId: string | null;
  phase: RoomRecord["phase"];
  selfPlayer: Player | null;
  onSubmitAction: (actionType: NightAction["action_type"]) => Promise<void>;
  isSubmittingAction: boolean;
  otherMafiaTargetName: string | null;
  myNightActions: NightAction[];
  actionMessage: string;
}) {
  const darkMode = phase === "night";
  const canAct = Boolean(selfPlayer?.is_alive && phase === "night");
  const currentAction = myNightActions[0];

  return (
    <div
      className={[
        "rounded-2xl border p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]",
        darkMode
          ? "border-white/10 bg-white/5 backdrop-blur"
          : "border-zinc-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className={[
              "text-xs font-black uppercase tracking-[0.18em]",
              darkMode ? "text-white/60" : "text-zinc-500",
            ].join(" ")}
          >
            Игроки
          </p>
          <h2 className="mt-2 text-2xl font-black">Список комнаты</h2>
        </div>

        <Button variant="ghost" onClick={onToggle}>
          {isExpanded ? "Свернуть" : "Раскрыть"}
        </Button>
      </div>

      {isExpanded ? (
        <div className="mt-4 grid gap-2">
          {players.map((player, index) => {
            const isSelf = player.id === localPlayerId;
            const isSelected = player.id === selectedPlayerId;

            return (
              <div
                key={player.id}
                className={[
                  "rounded-xl border px-4 py-3 transition",
                  darkMode
                    ? "border-white/10 bg-white/5 hover:bg-white/10"
                    : "border-zinc-200 bg-zinc-50 hover:bg-white",
                  isSelf
                    ? darkMode
                      ? "order-first border-2 border-emerald-400"
                      : "order-first border-2 border-zinc-950"
                    : "",
                  isSelected
                    ? darkMode
                      ? "ring-2 ring-white/40"
                      : "ring-2 ring-zinc-300"
                    : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onSelectPlayer(player.id)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 text-left"
                >
                  <div
                    className={[
                      "grid h-9 w-9 place-items-center rounded-full text-sm font-black",
                      darkMode
                        ? "bg-white text-zinc-950"
                        : "bg-white text-zinc-950",
                    ].join(" ")}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      {player.name}
                      {isSelf ? " (Вы)" : ""}
                    </p>
                    <p
                      className={[
                        "text-xs font-semibold",
                        darkMode ? "text-white/60" : "text-zinc-500",
                      ].join(" ")}
                    >
                      {player.is_host ? "Хост" : "Игрок"} ·{" "}
                      {player.is_alive ? "Жив" : "Выбыл"}
                    </p>
                  </div>
                  <div
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold",
                      darkMode
                        ? "bg-white/10 text-white"
                        : "bg-white text-zinc-600",
                    ].join(" ")}
                  >
                    {player.score}
                  </div>
                </button>

                {isSelected && canAct ? (
                  <div className="mt-3 border-t border-current/10 pt-3">
                    {selfPlayer?.role === "mafia" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="min-h-10 px-3 py-2"
                          disabled={
                            isSubmittingAction ||
                            !selfPlayer ||
                            !canTarget(selfPlayer, player)
                          }
                          onClick={() => {
                            void onSubmitAction("mafiaKill");
                          }}
                        >
                          Убить
                        </Button>
                      </div>
                    ) : null}

                    {selfPlayer?.role === "inspector" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="min-h-10 px-3 py-2"
                          disabled={
                            isSubmittingAction ||
                            !selfPlayer ||
                            selfPlayer.id === player.id ||
                            !player.is_alive
                          }
                          onClick={() => {
                            void onSubmitAction("detectiveCheck");
                          }}
                        >
                          Узнать роль
                        </Button>
                        <Button
                          className="min-h-10 px-3 py-2"
                          disabled={
                            isSubmittingAction ||
                            !selfPlayer ||
                            selfPlayer.id === player.id ||
                            !player.is_alive
                          }
                          onClick={() => {
                            void onSubmitAction("detectiveKill");
                          }}
                        >
                          Выстрелить
                        </Button>
                      </div>
                    ) : null}

                    {selfPlayer?.role === "doctor" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="min-h-10 px-3 py-2"
                          disabled={isSubmittingAction || !player.is_alive}
                          onClick={() => {
                            void onSubmitAction("doctorHeal");
                          }}
                        >
                          Спасти
                        </Button>
                      </div>
                    ) : null}

                    {currentAction ? (
                      <p
                        className={[
                          "mt-2 text-xs font-semibold",
                          darkMode ? "text-emerald-200" : "text-emerald-700",
                        ].join(" ")}
                      >
                        Ваш ночной выбор сохранён.
                      </p>
                    ) : null}

                    {selfPlayer?.role === "mafia" && otherMafiaTargetName ? (
                      <p
                        className={[
                          "mt-2 text-xs font-semibold",
                          darkMode ? "text-white/70" : "text-zinc-500",
                        ].join(" ")}
                      >
                        Другой мафиози выбрал: {otherMafiaTargetName}
                      </p>
                    ) : null}

                    {actionMessage ? (
                      <p
                        className={[
                          "mt-2 text-xs font-semibold",
                          darkMode ? "text-emerald-200" : "text-emerald-700",
                        ].join(" ")}
                      >
                        {actionMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WaitingPanel() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
        Ожидание
      </p>
      <h2 className="mt-2 text-2xl font-black">Хост настраивает игру</h2>
      <p className="mt-3 text-sm font-semibold text-zinc-500">
        Обычные игроки не видят параметры комнаты и ждут начала партии.
      </p>
    </div>
  );
}

function ActionPanel({
  room,
  selfPlayer,
  selectedPlayer,
  onSubmitAction,
  isSubmittingAction,
  otherMafiaTargetName,
  myNightActions,
}: {
  room: RoomRecord;
  selfPlayer: Player | null;
  selectedPlayer: Player | null;
  onSubmitAction: (actionType: NightAction["action_type"]) => void;
  isSubmittingAction: boolean;
  otherMafiaTargetName: string | null;
  myNightActions: NightAction[];
}) {
  const darkMode = room.phase === "night";
  const canAct = Boolean(selfPlayer?.is_alive && room.phase === "night");
  const currentAction = myNightActions[0];

  return (
    <div
      className={[
        "rounded-2xl border p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]",
        darkMode
          ? "border-white/10 bg-white/5 backdrop-blur"
          : "border-zinc-200 bg-white",
      ].join(" ")}
    >
      <p
        className={[
          "text-xs font-black uppercase tracking-[0.18em]",
          darkMode ? "text-white/60" : "text-zinc-500",
        ].join(" ")}
      >
        Действие
      </p>
      <h2 className="mt-2 text-2xl font-black">
        {selfPlayer ? formatRole(selfPlayer.role) : "Наблюдатель"}
      </h2>

      <p
        className={[
          "mt-3 text-sm font-semibold",
          darkMode ? "text-white/70" : "text-zinc-500",
        ].join(" ")}
      >
        {selfPlayer ? getRoleDescription(selfPlayer.role) : "Ожидайте."}
      </p>

      {selectedPlayer ? (
        <div
          className={[
            "mt-4 rounded-2xl border p-4",
            darkMode
              ? "border-white/10 bg-black/20"
              : "border-zinc-200 bg-zinc-50",
          ].join(" ")}
        >
          <p
            className={[
              "text-xs font-black uppercase tracking-[0.18em]",
              darkMode ? "text-white/60" : "text-zinc-500",
            ].join(" ")}
          >
            Выбран игрок
          </p>
          <p className="mt-2 text-2xl font-black">{selectedPlayer.name}</p>
        </div>
      ) : null}

      {currentAction ? (
        <p
          className={[
            "mt-4 text-sm font-semibold",
            darkMode ? "text-emerald-200" : "text-emerald-700",
          ].join(" ")}
        >
          Ваш текущий ночной выбор уже сохранён.
        </p>
      ) : null}

      {selfPlayer?.role === "mafia" && otherMafiaTargetName ? (
        <p
          className={[
            "mt-4 text-sm font-semibold",
            darkMode ? "text-white/70" : "text-zinc-500",
          ].join(" ")}
        >
          Другой мафиози выбрал игрока: {otherMafiaTargetName}
        </p>
      ) : null}

      {!canAct ? (
        <p
          className={[
            "mt-4 text-sm font-semibold",
            darkMode ? "text-white/60" : "text-zinc-500",
          ].join(" ")}
        >
          Сейчас действий нет. Ночью роли смогут выбрать цель.
        </p>
      ) : null}

      {canAct && selectedPlayer ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {selfPlayer?.role === "mafia" ? (
            <Button
              disabled={
                isSubmittingAction || !canTarget(selfPlayer, selectedPlayer)
              }
              onClick={() => {
                void onSubmitAction("mafiaKill");
              }}
            >
              Подтвердить жертву
            </Button>
          ) : null}

          {selfPlayer?.role === "inspector" ? (
            <>
              <Button
                disabled={
                  isSubmittingAction || selfPlayer.id === selectedPlayer.id
                }
                onClick={() => {
                  void onSubmitAction("detectiveCheck");
                }}
              >
                Узнать роль
              </Button>
              <Button
                disabled={
                  isSubmittingAction || selfPlayer.id === selectedPlayer.id
                }
                onClick={() => {
                  void onSubmitAction("detectiveKill");
                }}
              >
                Выстрелить
              </Button>
            </>
          ) : null}

          {selfPlayer?.role === "doctor" ? (
            <Button
              disabled={isSubmittingAction || !selectedPlayer.is_alive}
              onClick={() => {
                void onSubmitAction("doctorHeal");
              }}
            >
              Спасти
            </Button>
          ) : null}
        </div>
      ) : null}

      {room.phase === "day" ? (
        <p
          className={[
            "mt-4 text-sm font-semibold",
            darkMode ? "text-white/60" : "text-zinc-500",
          ].join(" ")}
        >
          Сейчас день. Обсуждайте, кого подозреваете, и ждите следующую ночь.
        </p>
      ) : null}
    </div>
  );
}

function HostControls({
  phase,
  roundNumber,
  onAdvancePhase,
  onEndGame,
}: {
  phase: RoomRecord["phase"];
  roundNumber: number;
  onAdvancePhase: () => void;
  onEndGame: () => void;
}) {
  const darkMode = phase === "night";

  return (
    <div
      className={[
        "rounded-2xl border p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]",
        darkMode
          ? "border-white/10 bg-white/5 backdrop-blur"
          : "border-zinc-200 bg-white",
      ].join(" ")}
    >
      <p
        className={[
          "text-xs font-black uppercase tracking-[0.18em]",
          darkMode ? "text-white/60" : "text-zinc-500",
        ].join(" ")}
      >
        Хост
      </p>
      <h2 className="mt-2 text-2xl font-black">Управление игрой</h2>
      <p
        className={[
          "mt-3 text-sm font-semibold",
          darkMode ? "text-white/70" : "text-zinc-500",
        ].join(" ")}
      >
        Раунд {roundNumber} · {formatPhase(phase)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onAdvancePhase}>
          {phase === "night" ? "Перейти к дню" : "Перейти к ночи"}
        </Button>
        <Button variant="ghost" onClick={onEndGame}>
          Завершить игру
        </Button>
      </div>
    </div>
  );
}

async function resolveNightPhase(
  room: RoomRecord,
  players: Player[],
  nightActions: NightAction[]
): Promise<void> {
  const alivePlayers = players.filter((player) => player.is_alive);
  const aliveMafia = alivePlayers.filter((player) => player.role === "mafia");
  const doctorActions = nightActions.filter(
    (action) => action.action_type === "doctorHeal"
  );
  const detectiveKillActions = nightActions.filter(
    (action) => action.action_type === "detectiveKill"
  );
  const mafiaActions = nightActions.filter(
    (action) =>
      action.action_type === "mafiaKill" &&
      aliveMafia.some((player) => player.id === action.actor_player_id)
  );

  const healedTargetIds = new Set(
    doctorActions
      .map((action) => action.target_player_id)
      .filter((targetId): targetId is string => Boolean(targetId))
  );

  const deathTargetIds = new Set<string>();
  const mafiaTargetId = resolveMafiaTargetId(room, aliveMafia, mafiaActions);

  if (mafiaTargetId && !healedTargetIds.has(mafiaTargetId)) {
    deathTargetIds.add(mafiaTargetId);
  }

  for (const action of detectiveKillActions) {
    if (
      action.target_player_id &&
      !healedTargetIds.has(action.target_player_id)
    ) {
      deathTargetIds.add(action.target_player_id);
    }
  }

  await Promise.all(
    [...deathTargetIds].map((playerId) => killPlayer(playerId))
  );

  if (deathTargetIds.size === 0) {
    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: "night",
      type: "night_result",
      message: "Ночь прошла без смертей.",
      visibility: "public",
      target_player_id: null,
    });
    return;
  }

  await Promise.all(
    [...deathTargetIds].map(async (playerId) => {
      const player = players.find((item) => item.id === playerId);

      await addGameEvent(room.id, {
        round_number: room.round_number,
        phase: "night",
        type: "night_result",
        message: `${player?.name ?? "Игрок"} не пережил эту ночь.`,
        visibility: "public",
        target_player_id: playerId,
      });
    })
  );
}

function getPhaseEndsAt(room: RoomRecord): number | undefined {
  const startedAt = new Date(room.updated_at).getTime();

  if (room.phase === "night") {
    return startedAt + room.settings.timers.nightSeconds * 1000;
  }

  if (room.phase === "day") {
    return startedAt + room.settings.timers.discussionSeconds * 1000;
  }

  if (room.phase === "voting" || room.phase === "voting_confirmation") {
    return startedAt + room.settings.timers.votingSeconds * 1000;
  }

  return undefined;
}

function orderPlayers(
  players: Player[],
  localPlayerId: string | null
): Player[] {
  return [...players].sort((left, right) => {
    if (left.id === localPlayerId && right.id !== localPlayerId) return -1;
    if (right.id === localPlayerId && left.id !== localPlayerId) return 1;
    return (
      new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime()
    );
  });
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

function canTarget(actor: Player, target: Player): boolean {
  if (!actor.is_alive || !target.is_alive) {
    return false;
  }

  if (actor.role === "mafia") {
    return actor.id !== target.id && target.role !== "mafia";
  }

  if (actor.role === "inspector") {
    return actor.id !== target.id;
  }

  if (actor.role === "doctor") {
    return true;
  }

  return false;
}

function resolveMafiaTargetId(
  room: RoomRecord,
  aliveMafia: Player[],
  mafiaActions: NightAction[]
): string | null {
  if (mafiaActions.length === 0) {
    return null;
  }

  if (aliveMafia.length <= 1) {
    return mafiaActions[0]?.target_player_id ?? null;
  }

  if (room.settings.mafiaDecisionMode === "unanimity") {
    if (mafiaActions.length < aliveMafia.length) {
      return null;
    }

    const firstTargetId = mafiaActions[0]?.target_player_id;

    if (
      firstTargetId &&
      mafiaActions.every((action) => action.target_player_id === firstTargetId)
    ) {
      return firstTargetId;
    }

    return null;
  }

  const votesByTarget = mafiaActions.reduce<Record<string, number>>(
    (accumulator, action) => {
      if (!action.target_player_id) {
        return accumulator;
      }

      accumulator[action.target_player_id] =
        (accumulator[action.target_player_id] ?? 0) + 1;

      return accumulator;
    },
    {}
  );

  const sortedVotes = Object.entries(votesByTarget).sort(
    (left, right) => right[1] - left[1]
  );

  if (sortedVotes.length === 0) {
    return null;
  }

  if (sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1]) {
    return null;
  }

  return sortedVotes[0][0];
}

function getNextPhase(currentPhase: RoomRecord["phase"]): RoomRecord["phase"] {
  if (currentPhase === "night") {
    return "day";
  }

  if (currentPhase === "day") {
    return "night";
  }

  if (currentPhase === "game_over") {
    return "game_over";
  }

  return "night";
}

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
      return "Подтверждение";
    case "game_over":
      return "Конец игры";
    default:
      return phase;
  }
}

function getPhaseEmoji(phase: RoomRecord["phase"]): string {
  switch (phase) {
    case "night":
      return "🌙";
    case "day":
      return "☀️";
    case "voting":
      return "🗳️";
    case "game_over":
      return "🏁";
    default:
      return "🎭";
  }
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
      return "Ночью выберите жертву. Если мафии двое, вы увидите выбор второго мафиози.";
    case "doctor":
      return "Ночью выберите, кого спасти. Самого себя можно спасти только один раз.";
    case "inspector":
      return "Ночью можно узнать роль игрока или выстрелить в него.";
    case "civilian":
      return "Ночью у вас нет действий. Днём обсуждайте и ищите мафию.";
    default:
      return "Роль будет выдана при старте игры.";
  }
}

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
