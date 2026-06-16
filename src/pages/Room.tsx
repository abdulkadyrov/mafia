import React from "react";
import { motion } from "framer-motion";
import { useAudioController } from "../core/audio/useAudioController";
import { samplePlayerNames } from "../game/defaults";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import { useCountdown } from "../hooks/useCountdown";
import {
  addGameEvent,
  addNightAction,
  addVote,
  getDoctorSelfHealCount,
  getGameEvents,
  getNightActions,
  getVotes,
} from "../services/gameService";
import {
  createPlayerInRoom,
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
  subscribeToEvents,
  subscribeToNightActions,
  subscribeToPlayers,
  subscribeToRoom,
  subscribeToVotes,
  unsubscribe,
} from "../services/realtimeService";
import { Button } from "../shared/ui/Button";
import type {
  GameEvent,
  NightAction,
  Player,
  PlayerRole,
  Room as RoomRecord,
  Vote,
} from "../types/database";
import type { RoomSettings } from "../types/game";

type Props = {
  onLeave: () => void;
  roomCode: string;
};

const PLAYER_ID_STORAGE_KEY = "mafia_player_id";
const ROOM_ID_STORAGE_KEY = "mafia_room_id";
const ROOM_CODE_STORAGE_KEY = "mafia_room_code";
const MANUAL_ASSIGNABLE_ROLES: PlayerRole[] = [
  "mafia",
  "doctor",
  "inspector",
  "civilian",
];

type GameOutcome = "mafia" | "civilians" | "doctor" | "draw";
type SuspicionMap = Record<string, number>;
type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export const Room: React.FC<Props> = ({ onLeave, roomCode }) => {
  const [room, setRoom] = React.useState<RoomRecord | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [nightActions, setNightActions] = React.useState<NightAction[]>([]);
  const [gameEvents, setGameEvents] = React.useState<GameEvent[]>([]);
  const [votes, setVotes] = React.useState<Vote[]>([]);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [actionMessage, setActionMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isStartingGame, setIsStartingGame] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [isAddingBots, setIsAddingBots] = React.useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatDraft, setChatDraft] = React.useState("");
  const [unreadChatCount, setUnreadChatCount] = React.useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(
    null
  );
  const [pendingVoteTargetId, setPendingVoteTargetId] = React.useState<
    string | null
  >(null);
  const [isPlayersExpanded, setIsPlayersExpanded] = React.useState(true);
  const lastSeenIncomingChatIdRef = React.useRef<string | null>(null);
  const hasInitializedChatRef = React.useRef(false);
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
          setGameEvents([]);
          setVotes([]);
          setErrorMessage("Комната не найдена");
          return;
        }

        const voteType =
          nextRoom.phase === "voting_confirmation" ? "runoff" : "main";

        const [nextPlayers, nextNightActions, nextEvents, nextVotes] =
          await Promise.all([
            getPlayers(nextRoom.id),
            nextRoom.phase === "lobby"
              ? Promise.resolve([])
              : getNightActions(nextRoom.id, nextRoom.round_number || 1),
            getGameEvents(nextRoom.id),
            nextRoom.phase === "voting" ||
            nextRoom.phase === "voting_confirmation"
              ? getVotes(nextRoom.id, nextRoom.round_number || 1, voteType)
              : Promise.resolve([]),
          ]);

        setRoom(nextRoom);
        setPlayers(nextPlayers);
        setNightActions(nextNightActions);
        setGameEvents(nextEvents);
        setVotes(nextVotes);
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
    const playersChannel = subscribeToPlayers(room.id, () => {
      void loadRoomData({ silent: true });
    });
    const nightActionsChannel = subscribeToNightActions(room.id, () => {
      void loadRoomData({ silent: true });
    });
    const eventsChannel = subscribeToEvents(room.id, () => {
      void loadRoomData({ silent: true });
    });
    const votesChannel = subscribeToVotes(room.id, () => {
      void loadRoomData({ silent: true });
    });

    return () => {
      unsubscribe(roomChannel);
      unsubscribe(playersChannel);
      unsubscribe(nightActionsChannel);
      unsubscribe(eventsChannel);
      unsubscribe(votesChannel);
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
  const phaseEndsAt = room ? getPhaseEndsAt(room) : undefined;
  const secondsLeft = useCountdown(phaseEndsAt);
  const orderedPlayers = React.useMemo(
    () => orderPlayers(players, localPlayerId),
    [players, localPlayerId]
  );
  const selectedPlayer =
    orderedPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const voteType = room?.phase === "voting_confirmation" ? "runoff" : "main";
  const currentVotesByTarget = React.useMemo(
    () =>
      votes.reduce<Record<string, number>>((accumulator, vote) => {
        if (!vote.target_player_id) {
          return accumulator;
        }

        accumulator[vote.target_player_id] =
          (accumulator[vote.target_player_id] ?? 0) + 1;
        return accumulator;
      }, {}),
    [votes]
  );
  const selfVote = votes.find((vote) => vote.voter_player_id === localPlayerId);
  const runoffCandidateIds = React.useMemo(
    () => getRunoffCandidateIds(gameEvents, room?.round_number ?? 0),
    [gameEvents, room?.round_number]
  );
  const winner =
    room?.phase === "game_over" ? getGameOutcome(players, gameEvents) : null;
  const { playMusic, stopMusic } = useAudioController();
  const chatMessages = React.useMemo(
    () =>
      gameEvents
        .filter((event) => event.type === "chat_message")
        .map(parseChatMessageEvent)
        .filter((message): message is ChatMessage => Boolean(message)),
    [gameEvents]
  );

  React.useEffect(() => {
    const latestIncomingMessage = [...chatMessages]
      .reverse()
      .find((message) => message.authorId !== localPlayerId);

    if (!hasInitializedChatRef.current) {
      hasInitializedChatRef.current = true;
      lastSeenIncomingChatIdRef.current = latestIncomingMessage?.id ?? null;
      return;
    }

    if (isChatOpen) {
      lastSeenIncomingChatIdRef.current = latestIncomingMessage?.id ?? null;
      setUnreadChatCount(0);
      return;
    }

    if (!latestIncomingMessage) {
      return;
    }

    if (lastSeenIncomingChatIdRef.current === latestIncomingMessage.id) {
      return;
    }

    const newIncomingCount = [...chatMessages].filter((message) => {
      if (message.authorId === localPlayerId) {
        return false;
      }

      if (!lastSeenIncomingChatIdRef.current) {
        return true;
      }

      const messageTime = new Date(message.createdAt).getTime();
      const lastSeenMessage = chatMessages.find(
        (item) => item.id === lastSeenIncomingChatIdRef.current
      );
      const lastSeenTime = lastSeenMessage
        ? new Date(lastSeenMessage.createdAt).getTime()
        : 0;

      return messageTime > lastSeenTime;
    }).length;

    lastSeenIncomingChatIdRef.current = latestIncomingMessage.id;
    setUnreadChatCount((current) => current + newIncomingCount);
  }, [chatMessages, isChatOpen, localPlayerId]);

  React.useEffect(() => {
    if (!room) {
      stopMusic();
      return;
    }

    if (room.phase === "night") {
      void playMusic("bgGame");
      return;
    }

    if (room.phase === "day") {
      void playMusic("clockTick");
      return;
    }

    if (room.phase === "voting" || room.phase === "voting_confirmation") {
      void playMusic("bgAudience");
      return;
    }

    stopMusic();
  }, [playMusic, room, stopMusic]);

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
      const latestPlayers = await getPlayers(room.id);

      if (room.settings.roleAssignmentMode === "manual") {
        const manualAssignmentError = validateManualRoleAssignments(
          latestPlayers,
          room.settings
        );

        if (manualAssignmentError) {
          throw new Error(manualAssignmentError);
        }
      }

      const assignedRoles = buildRoleAssignments(latestPlayers, room.settings);

      await Promise.all(
        assignedRoles.map((player) => updatePlayerRole(player.id, player.role))
      );
      setPlayers(
        latestPlayers.map((player) => {
          const assignedPlayer = assignedRoles.find(
            (item) => item.id === player.id
          );

          return {
            ...player,
            role: assignedPlayer?.role ?? player.role,
          };
        })
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

  async function handleAddBots(mode: "one" | "fill") {
    if (!room || !isHost || room.phase !== "lobby") {
      return;
    }

    setIsAddingBots(true);
    setErrorMessage("");
    setActionMessage("");

    try {
      const existingNames = new Set(
        players.map((player) => player.name.toLowerCase())
      );
      const freeSlots = Math.max(0, room.settings.playerLimit - players.length);
      const availableNames = samplePlayerNames.filter(
        (name) => !existingNames.has(name.toLowerCase())
      );
      const botsToCreate =
        mode === "one"
          ? Math.min(1, freeSlots, availableNames.length)
          : Math.min(freeSlots, availableNames.length);

      if (botsToCreate <= 0) {
        throw new Error("Нет свободных мест для ботов");
      }

      const namesToCreate = availableNames.slice(0, botsToCreate);

      await Promise.all(
        namesToCreate.map((name) => createPlayerInRoom(room.id, name))
      );

      await addGameEvent(room.id, {
        round_number: 0,
        phase: "lobby",
        type: "bots_added",
        message:
          botsToCreate === 1
            ? `Добавлен бот ${namesToCreate[0]}.`
            : `Добавлены боты: ${namesToCreate.join(", ")}.`,
        visibility: "public",
        target_player_id: null,
      });

      setActionMessage(
        botsToCreate === 1
          ? `Бот ${namesToCreate[0]} добавлен.`
          : `Добавлено ботов: ${namesToCreate.length}.`
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось добавить ботов"));
    } finally {
      setIsAddingBots(false);
    }
  }

  async function handleManualRoleAssign(
    targetPlayer: Player,
    role: PlayerRole
  ) {
    if (
      !room ||
      !isHost ||
      room.phase !== "lobby" ||
      room.settings.roleAssignmentMode !== "manual"
    ) {
      return;
    }

    const assignmentError = getManualRoleAssignmentError(
      targetPlayer,
      role,
      players,
      room.settings
    );

    if (assignmentError) {
      setErrorMessage(assignmentError);
      return;
    }

    setErrorMessage("");
    setActionMessage("");

    try {
      await updatePlayerRole(targetPlayer.id, role);
      setPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === targetPlayer.id ? { ...player, role } : player
        )
      );
      setActionMessage(`${targetPlayer.name}: назначена роль ${formatRole(role)}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось назначить роль"));
    }
  }

  async function handleRoleAction(
    targetPlayer: Player,
    actionType: NightAction["action_type"]
  ) {
    if (
      !room ||
      !selfPlayer ||
      room.phase !== "night" ||
      !selfPlayer.is_alive ||
      !canTarget(selfPlayer, targetPlayer)
    ) {
      return;
    }

    setIsSubmittingAction(true);
    setErrorMessage("");
    setActionMessage("");

    try {
      if (actionType === "doctorHeal" && targetPlayer.id === selfPlayer.id) {
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
        target_player_id: targetPlayer.id,
        action_type: actionType,
      });

      if (isPublicNightAction(actionType)) {
        await addGameEvent(room.id, {
          round_number: room.round_number || 1,
          phase: "night",
          type: actionType,
          message: getNightActionEventText(actionType),
          visibility: "public",
          target_player_id: null,
        });
      }

      if (actionType === "detectiveCheck") {
        setActionMessage(
          `${targetPlayer.name}: ${formatRole(targetPlayer.role)}`
        );
      } else {
        setActionMessage(getActionConfirmation(actionType, targetPlayer.name));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось сохранить действие"));
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleStartVoting() {
    if (!room || !isHost || room.phase !== "day") {
      return;
    }

    try {
      await addGameEvent(room.id, {
        round_number: room.round_number,
        phase: "voting",
        type: "voting_started",
        message: "Вы должны голосовать.",
        visibility: "public",
        target_player_id: null,
      });
      await updateRoomPhase(room.id, "voting");
      setPendingVoteTargetId(null);
      setActionMessage("Голосование началось.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось начать голосование"));
    }
  }

  async function handleSubmitVote(targetPlayer: Player) {
    if (
      !room ||
      !selfPlayer ||
      !selfPlayer.is_alive ||
      (room.phase !== "voting" && room.phase !== "voting_confirmation") ||
      !targetPlayer.is_alive
    ) {
      return;
    }

    try {
      await addVote(room.id, {
        round_number: room.round_number || 1,
        voter_player_id: selfPlayer.id,
        target_player_id: targetPlayer.id,
        vote_type: voteType,
      });

      await addGameEvent(room.id, {
        round_number: room.round_number || 1,
        phase: room.phase,
        type: room.phase === "voting_confirmation" ? "runoff_vote" : "vote_cast",
        message: getVoteEventText(selfPlayer.name, targetPlayer.name, room.phase),
        visibility: "public",
        target_player_id: targetPlayer.id,
      });

      setPendingVoteTargetId(null);
      setActionMessage(`Ваш голос за ${targetPlayer.name} сохранён.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось сохранить голос"));
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
        await ensureBotPhaseActions(room, players, gameEvents, votes, nightActions);
        const latestNightActions = await getNightActions(
          room.id,
          room.round_number || 1
        );
        const nightOutcome = await resolveNightPhase(
          room,
          players,
          latestNightActions
        );

        if (nightOutcome) {
          await addGameEvent(room.id, {
            round_number: room.round_number,
            phase: "game_over",
            type: getGameOverEventType(nightOutcome),
            message: getGameOverMessage(nightOutcome),
            visibility: "public",
            target_player_id: null,
          });
          await updateRoomPhase(room.id, "game_over", {
            roundNumber: room.round_number,
          });
          return;
        }

        await updateRoomPhase(room.id, "day", {
          roundNumber: room.round_number,
        });
        return;
      }

      if (room.phase === "day") {
        await handleStartVoting();
        return;
      }

      if (room.phase === "voting" || room.phase === "voting_confirmation") {
        await ensureBotPhaseActions(room, players, gameEvents, votes, nightActions);
        const latestVotes = await getVotes(
          room.id,
          room.round_number || 1,
          voteType
        );
        await resolveVotingPhase(
          room,
          players,
          latestVotes,
          voteType,
          runoffCandidateIds
        );
        const reloadedRoom = await getRoomByCode(room.code);

        if (!reloadedRoom) {
          return;
        }

        const winnerAfterVoting = getWinner(await getPlayers(reloadedRoom.id));

        if (winnerAfterVoting) {
          await addGameEvent(reloadedRoom.id, {
            round_number: reloadedRoom.round_number,
            phase: "game_over",
            type: getGameOverEventType(winnerAfterVoting),
            message: getGameOverMessage(winnerAfterVoting),
            visibility: "public",
            target_player_id: null,
          });
          await updateRoomPhase(reloadedRoom.id, "game_over", {
            roundNumber: reloadedRoom.round_number,
          });
          return;
        }

        if (room.phase === "voting_confirmation") {
          await updateRoomPhase(room.id, "night", {
            roundNumber: room.round_number + 1,
          });
        }

        return;
      }
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

  async function handleSendChatMessage() {
    if (!room || !selfPlayer) {
      return;
    }

    const text = chatDraft.trim();

    if (!text) {
      return;
    }

    try {
      await addGameEvent(room.id, {
        round_number: room.round_number,
        phase: room.phase,
        type: "chat_message",
        message: JSON.stringify({
          authorId: selfPlayer.id,
          authorName: selfPlayer.name,
          text,
        }),
        visibility: "public",
        target_player_id: null,
      });
      setChatDraft("");
      setIsChatOpen(true);
      setUnreadChatCount(0);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не удалось отправить сообщение"));
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
        "h-screen overflow-hidden px-4 py-4",
        room.phase === "night" ? "text-white" : "text-zinc-950",
      ].join(" ")}
    >
      <div className="mx-auto grid h-full w-full max-w-7xl grid-rows-[auto_auto_1fr] gap-3">
        <header
          className={[
            "flex items-center justify-between gap-3 border-b pb-3",
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
          <section className="grid place-items-center gap-2 text-center">
            <p
              className={[
                "text-sm font-black uppercase tracking-[0.28em]",
                room.phase === "night" ? "text-white/60" : "text-zinc-500",
              ].join(" ")}
            >
              {getPhaseEmoji(room.phase)} {formatPhase(room.phase)}
            </p>
            <p className="font-mono text-5xl font-black tracking-[0.24em] sm:text-6xl">
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

        <section className="grid min-h-0 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-h-0">
            <PlayersPanel
              room={room}
              players={orderedPlayers}
              localPlayerId={localPlayerId}
              isHost={isHost}
              isExpanded={isPlayersExpanded}
              onToggle={() => setIsPlayersExpanded((current) => !current)}
              onSelectPlayer={setSelectedPlayerId}
              selectedPlayerId={selectedPlayerId}
              selfPlayer={selfPlayer}
              onManualRoleAssign={handleManualRoleAssign}
              isSubmittingAction={isSubmittingAction}
              onRoleAction={handleRoleAction}
              onSetPendingVoteTarget={setPendingVoteTargetId}
              pendingVoteTargetId={pendingVoteTargetId}
              onSubmitVote={handleSubmitVote}
              selfVote={selfVote}
              currentVotesByTarget={currentVotesByTarget}
              runoffCandidateIds={runoffCandidateIds}
              actionMessage={actionMessage}
              errorMessage={errorMessage}
            />
          </div>

          <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
            {room.phase === "lobby" ? (
              isHost ? (
                <SettingsPanel
                  settings={room.settings as RoomSettings}
                  isSavingSettings={isSavingSettings}
                  isAddingBots={isAddingBots}
                  onChange={handleSettingsChange}
                  onAddBot={() => {
                    void handleAddBots("one");
                  }}
                  onFillBots={() => {
                    void handleAddBots("fill");
                  }}
                />
              ) : (
                <WaitingPanel />
              )
            ) : room.phase === "game_over" ? (
              <FinalPanel players={players} winner={winner} />
            ) : (
              <HostControls
                room={room}
                isHost={isHost}
                onAdvancePhase={() => {
                  void handleAdvancePhase();
                }}
                onEndGame={() => {
                  void handleEndGame();
                }}
              />
            )}

            <EventsPanel
              phase={room.phase}
              events={gameEvents}
              actionMessage={actionMessage}
            />
          </div>
        </section>
      </div>

      <FloatingChat
        darkMode={room.phase === "night"}
        isOpen={isChatOpen}
        unreadCount={unreadChatCount}
        messages={chatMessages}
        localPlayerId={localPlayerId}
        draft={chatDraft}
        onDraftChange={setChatDraft}
        onSend={() => {
          void handleSendChatMessage();
        }}
        onToggle={() => {
          setIsChatOpen((current) => !current);
          setUnreadChatCount(0);
        }}
      />
    </motion.main>
  );
};

function PlayersPanel({
  room,
  players,
  localPlayerId,
  isHost,
  isExpanded,
  onToggle,
  onSelectPlayer,
  selectedPlayerId,
  selfPlayer,
  onManualRoleAssign,
  isSubmittingAction,
  onRoleAction,
  onSetPendingVoteTarget,
  pendingVoteTargetId,
  onSubmitVote,
  selfVote,
  currentVotesByTarget,
  runoffCandidateIds,
  actionMessage,
  errorMessage,
}: {
  room: RoomRecord;
  players: Player[];
  localPlayerId: string | null;
  isHost: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectPlayer: (playerId: string) => void;
  selectedPlayerId: string | null;
  selfPlayer: Player | null;
  onManualRoleAssign: (targetPlayer: Player, role: PlayerRole) => Promise<void>;
  isSubmittingAction: boolean;
  onRoleAction: (
    targetPlayer: Player,
    actionType: NightAction["action_type"]
  ) => Promise<void>;
  onSetPendingVoteTarget: (playerId: string | null) => void;
  pendingVoteTargetId: string | null;
  onSubmitVote: (targetPlayer: Player) => Promise<void>;
  selfVote?: Vote;
  currentVotesByTarget: Record<string, number>;
  runoffCandidateIds: string[];
  actionMessage: string;
  errorMessage: string;
}) {
  const darkMode = room.phase === "night";
  const canActAtNight = Boolean(selfPlayer?.is_alive && room.phase === "night");
  const roleCounts = React.useMemo(() => countAssignedRoles(players), [players]);
  const manualMode =
    room.phase === "lobby" && isHost && room.settings.roleAssignmentMode === "manual";
  const canVote =
    Boolean(selfPlayer?.is_alive) &&
    (room.phase === "voting" || room.phase === "voting_confirmation");

  return (
    <div
      className={[
        "grid h-full min-h-0 rounded-2xl border p-4 shadow-[0_18px_70px_rgba(15,23,42,0.08)]",
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
          <h2 className="mt-1 text-2xl font-black">Список комнаты</h2>
        </div>

        <Button variant="ghost" onClick={onToggle}>
          {isExpanded ? "Свернуть" : "Раскрыть"}
        </Button>
      </div>

      {manualMode ? (
        <div
          className={[
            "mt-3 flex flex-wrap gap-2 text-xs font-semibold",
            darkMode ? "text-white/70" : "text-zinc-600",
          ].join(" ")}
        >
          {MANUAL_ASSIGNABLE_ROLES.map((role) => (
            <span
              key={role}
              className={[
                "rounded-full px-3 py-1",
                darkMode ? "bg-white/10" : "bg-zinc-100",
              ].join(" ")}
            >
              {formatRole(role)}:{" "}
              {role === "civilian"
                ? roleCounts.civilian + roleCounts.unassigned
                : roleCounts[role]}
              /
              {getRoleLimit(role, room.settings, players.length)}
            </span>
          ))}
        </div>
      ) : null}

      {isExpanded ? (
        <div className="mt-3 min-h-0 space-y-2 overflow-auto pr-1">
          {players.map((player, index) => {
            const isSelf = player.id === localPlayerId;
            const isSelected = player.id === selectedPlayerId;
            const isDead = !player.is_alive;
            const canVoteForThisPlayer =
              canVote &&
              player.is_alive &&
              player.id !== localPlayerId &&
              (room.phase !== "voting_confirmation" ||
                runoffCandidateIds.includes(player.id));
            const showVoteConfirm = pendingVoteTargetId === player.id;

            return (
              <div
                key={player.id}
                className={[
                  "rounded-xl border px-4 py-3 transition",
                  isDead
                    ? "border-red-400/40 bg-red-500/10 opacity-60"
                    : darkMode
                    ? "border-white/10 bg-white/5"
                    : "border-zinc-200 bg-zinc-50",
                  isSelf
                    ? darkMode
                      ? "border-2 border-emerald-400"
                      : "border-2 border-zinc-950"
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
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-black text-zinc-950">
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
                      {player.is_alive ? "Жив" : "Погиб"}
                      {manualMode ? ` · ${formatRole(player.role)}` : ""}
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
                    {currentVotesByTarget[player.id] ?? 0}
                  </div>
                </button>

                {isSelected && canActAtNight && selfPlayer ? (
                  <div className="mt-3 border-t border-current/10 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {selfPlayer.role === "mafia" ? (
                        <Button
                          className="min-h-10 px-3 py-2"
                          disabled={
                            isSubmittingAction || !canTarget(selfPlayer, player)
                          }
                          onClick={() => {
                            void onRoleAction(player, "mafiaKill");
                          }}
                        >
                          Убить
                        </Button>
                      ) : null}

                      {selfPlayer.role === "inspector" ? (
                        <>
                          <Button
                            className="min-h-10 px-3 py-2"
                            disabled={
                              isSubmittingAction ||
                              !canTarget(selfPlayer, player)
                            }
                            onClick={() => {
                              void onRoleAction(player, "detectiveCheck");
                            }}
                          >
                            Узнать роль
                          </Button>
                          <Button
                            className="min-h-10 px-3 py-2"
                            disabled={
                              isSubmittingAction ||
                              !canTarget(selfPlayer, player)
                            }
                            onClick={() => {
                              void onRoleAction(player, "detectiveKill");
                            }}
                          >
                            Выстрелить
                          </Button>
                        </>
                      ) : null}

                      {selfPlayer.role === "doctor" ? (
                        <Button
                          className="min-h-10 px-3 py-2"
                          disabled={isSubmittingAction || !player.is_alive}
                          onClick={() => {
                            void onRoleAction(player, "doctorHeal");
                          }}
                        >
                          Спасти
                        </Button>
                      ) : null}
                    </div>

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

                {isSelected && manualMode ? (
                  <div className="mt-3 border-t border-current/10 pt-3">
                    <p
                      className={[
                        "mb-2 text-xs font-bold uppercase tracking-[0.14em]",
                        darkMode ? "text-white/60" : "text-zinc-500",
                      ].join(" ")}
                    >
                      Назначить роль
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MANUAL_ASSIGNABLE_ROLES.map((role) => {
                        const disabled = Boolean(
                          getManualRoleAssignmentError(
                            player,
                            role,
                            players,
                            room.settings
                          )
                        );

                        return (
                          <Button
                            key={role}
                            className="min-h-10 px-3 py-2"
                            disabled={disabled}
                            variant={player.role === role ? "primary" : "secondary"}
                            onClick={() => {
                              void onManualRoleAssign(player, role);
                            }}
                          >
                            {formatRole(role)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {isSelected && canVoteForThisPlayer ? (
                  <div className="mt-3 border-t border-current/10 pt-3">
                    {!showVoteConfirm ? (
                      <Button
                        className="min-h-10 px-3 py-2"
                        onClick={() => onSetPendingVoteTarget(player.id)}
                      >
                        Голосовать
                      </Button>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="min-h-10 px-3 py-2"
                          variant="primary"
                          onClick={() => {
                            void onSubmitVote(player);
                          }}
                        >
                          Подтвердить голос
                        </Button>
                        <Button
                          className="min-h-10 px-3 py-2"
                          variant="ghost"
                          onClick={() => onSetPendingVoteTarget(null)}
                        >
                          Отмена
                        </Button>
                      </div>
                    )}

                    {selfVote ? (
                      <p
                        className={[
                          "mt-2 text-xs font-semibold",
                          darkMode ? "text-emerald-200" : "text-emerald-700",
                        ].join(" ")}
                      >
                        Ваш голос уже сохранён.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {errorMessage && !isExpanded ? (
        <p className="mt-3 text-xs font-semibold text-red-500">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  settings,
  isSavingSettings,
  isAddingBots,
  onChange,
  onAddBot,
  onFillBots,
}: {
  settings: RoomSettings;
  isSavingSettings: boolean;
  isAddingBots: boolean;
  onChange: (settings: RoomSettings) => void;
  onAddBot: () => void;
  onFillBots: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
            Настройки
          </p>
          <h2 className="mt-2 text-2xl font-black">Параметры комнаты</h2>
        </div>
        <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold text-zinc-600">
          {isSavingSettings
            ? "Сохранение..."
            : isAddingBots
            ? "Добавляем ботов..."
            : "Только хост"}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="min-h-10 px-3 py-2"
          disabled={isAddingBots}
          onClick={onAddBot}
        >
          + Бот
        </Button>
        <Button
          className="min-h-10 px-3 py-2"
          variant="ghost"
          disabled={isAddingBots}
          onClick={onFillBots}
        >
          Заполнить ботами
        </Button>
      </div>

      <div className="mt-4 max-h-[35vh] overflow-auto pr-1">
        <RoomSettingsForm settings={settings} onChange={onChange} />
      </div>
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

function HostControls({
  room,
  isHost,
  onAdvancePhase,
  onEndGame,
}: {
  room: RoomRecord;
  isHost: boolean;
  onAdvancePhase: () => void;
  onEndGame: () => void;
}) {
  const darkMode = room.phase === "night";

  if (!isHost) {
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
          Фаза
        </p>
        <h2 className="mt-2 text-2xl font-black">{formatPhase(room.phase)}</h2>
        <p
          className={[
            "mt-3 text-sm font-semibold",
            darkMode ? "text-white/70" : "text-zinc-500",
          ].join(" ")}
        >
          Следуйте подсказкам на экране и ждите действий хоста.
        </p>
      </div>
    );
  }

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
        Раунд {room.round_number} · {formatPhase(room.phase)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onAdvancePhase}>
          {getAdvanceButtonLabel(room.phase)}
        </Button>
        <Button variant="ghost" onClick={onEndGame}>
          Завершить игру
        </Button>
      </div>
    </div>
  );
}

function EventsPanel({
  phase,
  events,
  actionMessage,
}: {
  phase: RoomRecord["phase"];
  events: GameEvent[];
  actionMessage: string;
}) {
  const darkMode = phase === "night";
  const visibleEvents = events
    .filter((event) => event.type !== "chat_message")
    .slice(-14)
    .reverse();

  return (
    <div
      className={[
        "grid min-h-0 rounded-2xl border p-4 shadow-[0_18px_70px_rgba(15,23,42,0.08)]",
        darkMode
          ? "border-white/10 bg-white/5 backdrop-blur"
          : "border-zinc-200 bg-white",
      ].join(" ")}
    >
      <div className="mb-3">
        <p
          className={[
            "text-xs font-black uppercase tracking-[0.18em]",
            darkMode ? "text-white/60" : "text-zinc-500",
          ].join(" ")}
        >
          События
        </p>
        <h2 className="mt-1 text-xl font-black">Журнал игры</h2>
      </div>

      <div className="min-h-0 space-y-2 overflow-auto pr-1">
        {actionMessage ? (
          <article
            className={[
              "ml-auto max-w-[88%] rounded-2xl px-4 py-2 text-xs font-semibold",
              darkMode
                ? "bg-emerald-500/20 text-emerald-100"
                : "bg-emerald-50 text-emerald-800",
            ].join(" ")}
          >
            {actionMessage}
          </article>
        ) : null}

        {visibleEvents.length === 0 ? (
          <p
            className={[
              "text-sm font-semibold",
              darkMode ? "text-white/60" : "text-zinc-500",
            ].join(" ")}
          >
            События появятся после старта игры.
          </p>
        ) : (
          visibleEvents.map((event) => (
            <article
              key={event.id}
              className={[
                "max-w-[92%] rounded-2xl px-4 py-2 text-xs font-semibold",
                darkMode
                  ? "bg-white/10 text-white"
                  : "bg-zinc-100 text-zinc-800",
              ].join(" ")}
            >
              {event.message}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function FloatingChat({
  darkMode,
  isOpen,
  unreadCount,
  messages,
  localPlayerId,
  draft,
  onDraftChange,
  onSend,
  onToggle,
}: {
  darkMode: boolean;
  isOpen: boolean;
  unreadCount: number;
  messages: ChatMessage[];
  localPlayerId: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex items-end gap-3">
      {isOpen ? (
        <div
          className={[
            "pointer-events-auto flex h-[28rem] w-[22rem] max-w-[calc(100vw-5rem)] flex-col overflow-hidden rounded-3xl border shadow-[0_24px_80px_rgba(15,23,42,0.24)]",
            darkMode
              ? "border-white/10 bg-[#09111f]/95 text-white backdrop-blur"
              : "border-zinc-200 bg-white text-zinc-950",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-center justify-between border-b px-4 py-3",
              darkMode ? "border-white/10" : "border-zinc-200",
            ].join(" ")}
          >
            <div>
              <p
                className={[
                  "text-xs font-black uppercase tracking-[0.18em]",
                  darkMode ? "text-white/50" : "text-zinc-500",
                ].join(" ")}
              >
                Чат
              </p>
              <h3 className="text-lg font-black">Сообщения комнаты</h3>
            </div>
            <Button className="min-h-9 px-3 py-2" variant="ghost" onClick={onToggle}>
              Скрыть
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
            {messages.length === 0 ? (
              <p
                className={[
                  "text-sm font-semibold",
                  darkMode ? "text-white/60" : "text-zinc-500",
                ].join(" ")}
              >
                Пока пусто. Можно написать первым.
              </p>
            ) : (
              messages.map((message) => {
                const isOwn = message.authorId === localPlayerId;

                return (
                  <article
                    key={message.id}
                    className={[
                      "max-w-[88%] rounded-2xl px-4 py-3",
                      isOwn
                        ? darkMode
                          ? "ml-auto bg-emerald-500/20"
                          : "ml-auto bg-emerald-50"
                        : darkMode
                        ? "bg-white/10"
                        : "bg-zinc-100",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-xs font-black",
                        isOwn
                          ? darkMode
                            ? "text-emerald-200"
                            : "text-emerald-700"
                          : darkMode
                          ? "text-sky-200"
                          : "text-sky-700",
                      ].join(" ")}
                    >
                      {message.authorName}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-5">
                      {message.text}
                    </p>
                  </article>
                );
              })
            )}
          </div>

          <div
            className={[
              "border-t p-3",
              darkMode ? "border-white/10" : "border-zinc-200",
            ].join(" ")}
          >
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Написать сообщение..."
                className={[
                  "min-h-[52px] flex-1 resize-none rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition",
                  darkMode
                    ? "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-white/30"
                    : "border-zinc-200 bg-zinc-50 text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-400",
                ].join(" ")}
              />
              <Button className="min-h-[52px] px-4" variant="primary" onClick={onSend}>
                Отпр.
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto relative">
        {unreadCount > 0 ? (
          <div className="absolute -top-2 right-2 rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white shadow-[0_10px_28px_rgba(239,68,68,0.35)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className={[
            "grid h-16 w-16 place-items-center rounded-full border text-xl font-black shadow-[0_24px_70px_rgba(15,23,42,0.28)] transition hover:scale-[1.03]",
            darkMode
              ? "border-white/10 bg-emerald-500 text-white"
              : "border-zinc-200 bg-white text-zinc-950",
          ].join(" ")}
        >
          Чат
        </button>
      </div>
    </div>
  );
}

function FinalPanel({
  players,
  winner,
}: {
  players: Player[];
  winner: GameOutcome | null;
}) {
  const rankedPlayers = [...players]
    .map((player) => ({
      ...player,
      finalScore: computeFinalScore(player, winner),
    }))
    .sort((left, right) => right.finalScore - left.finalScore);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
        Финал
      </p>
      <h2 className="mt-2 text-2xl font-black">
        {getGameOverMessage(winner)}
      </h2>

      <div className="mt-4 space-y-2">
        {rankedPlayers.map((player, index) => (
          <div
            key={player.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
          >
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black text-zinc-950">
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{player.name}</p>
              <p className="text-xs font-semibold text-zinc-500">
                {formatRole(player.role)} ·{" "}
                {player.is_alive ? "Выжил" : "Выбыл"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black">{player.finalScore}</p>
              <p className="text-xs font-semibold text-zinc-500">очков</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function resolveNightPhase(
  room: RoomRecord,
  players: Player[],
  nightActions: NightAction[]
): Promise<GameOutcome | null> {
  const alivePlayers = players.filter((player) => player.is_alive);
  const aliveMafia = alivePlayers.filter((player) => player.role === "mafia");
  const aliveInspectors = alivePlayers.filter(
    (player) => player.role === "inspector"
  );
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

  if (mafiaTargetId && healedTargetIds.has(mafiaTargetId)) {
    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: "night",
      type: "night_saved",
      message: "Доктор спас игрока.",
      visibility: "public",
      target_player_id: mafiaTargetId,
    });
  }

  if (deathTargetIds.size === 0) {
    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: "night",
      type: "night_result",
      message: "Ночь прошла без смертей.",
      visibility: "public",
      target_player_id: null,
    });
  } else {
    await Promise.all(
      [...deathTargetIds].map(async (playerId) => {
        const player = players.find((item) => item.id === playerId);

        await killPlayer(playerId);
        await addGameEvent(room.id, {
          round_number: room.round_number,
          phase: "night",
          type: "night_result",
          message: `${player?.name ?? "Игрок"} погиб этой ночью.`,
          visibility: "public",
          target_player_id: playerId,
        });
        await addGameEvent(room.id, {
          round_number: room.round_number,
          phase: "night",
          type: "role_revealed",
          message: `Роль игрока ${player?.name ?? "Игрок"}: ${formatRole(
            player?.role ?? "civilian"
          )}.`,
          visibility: "public",
          target_player_id: playerId,
        });
      })
    );
  }

  const doctorSelfSaveCandidates = alivePlayers.filter(
    (player) =>
      player.role === "doctor" &&
      mafiaTargetId === player.id &&
      !deathTargetIds.has(player.id) &&
      doctorActions.some(
        (action) =>
          action.actor_player_id === player.id &&
          action.target_player_id === player.id
      )
  );
  const doctorSelfSaveChecks = await Promise.all(
    doctorSelfSaveCandidates.map(async (player) => ({
      player,
      selfHealCount: await getDoctorSelfHealCount(room.id, player.id),
    }))
  );
  const doctorSelfSave = doctorSelfSaveChecks.some(
    ({ selfHealCount }) => selfHealCount === 1
  );

  const mutualInspectorDraw =
    aliveInspectors.some((inspector) => deathTargetIds.has(inspector.id)) &&
    detectiveKillActions.some((action) => {
      const target = players.find((player) => player.id === action.target_player_id);
      const inspector = players.find((player) => player.id === action.actor_player_id);

      return (
        inspector?.role === "inspector" &&
        target?.role === "mafia" &&
        Boolean(target.id && deathTargetIds.has(target.id)) &&
        mafiaTargetId === inspector.id
      );
    });

  if (doctorSelfSave) {
    return "doctor";
  }

  if (mutualInspectorDraw) {
    return "draw";
  }

  const resolvedPlayers = players.map((player) => ({
    ...player,
    is_alive: player.is_alive && !deathTargetIds.has(player.id),
  }));

  return getWinner(resolvedPlayers);
}

async function ensureBotPhaseActions(
  room: RoomRecord,
  players: Player[],
  gameEvents: GameEvent[],
  votes: Vote[],
  nightActions: NightAction[]
): Promise<void> {
  const alivePlayers = players.filter((player) => player.is_alive);
  const botPlayers = alivePlayers.filter(isBotPlayer);

  if (botPlayers.length === 0) {
    return;
  }

  if (room.phase === "night") {
    await Promise.all(
      botPlayers.map(async (bot) => {
        const action = await chooseBotNightAction(
          room,
          bot,
          alivePlayers,
          gameEvents,
          nightActions
        );

        if (!action) {
          return;
        }

        await addNightAction(room.id, {
          round_number: room.round_number || 1,
          actor_player_id: bot.id,
          target_player_id: action.targetPlayerId,
          action_type: action.actionType,
        });

        if (isPublicNightAction(action.actionType)) {
          await addGameEvent(room.id, {
            round_number: room.round_number || 1,
            phase: "night",
            type: action.actionType,
            message: getNightActionEventText(action.actionType),
            visibility: "public",
            target_player_id: null,
          });
        }
      })
    );
    return;
  }

  if (room.phase === "voting" || room.phase === "voting_confirmation") {
    await Promise.all(
      botPlayers.map(async (bot) => {
        const alreadyVoted = votes.some(
          (vote) =>
            vote.voter_player_id === bot.id &&
            vote.vote_type ===
              (room.phase === "voting_confirmation" ? "runoff" : "main")
        );

        if (alreadyVoted) {
          return;
        }

        const targetPlayerId = chooseBotVoteTarget(
          room,
          bot,
          alivePlayers,
          gameEvents,
          votes
        );

        if (!targetPlayerId) {
          return;
        }

        await addVote(room.id, {
          round_number: room.round_number || 1,
          voter_player_id: bot.id,
          target_player_id: targetPlayerId,
          vote_type: room.phase === "voting_confirmation" ? "runoff" : "main",
        });

        const targetPlayer = alivePlayers.find(
          (player) => player.id === targetPlayerId
        );

        if (targetPlayer) {
          await addGameEvent(room.id, {
            round_number: room.round_number || 1,
            phase: room.phase,
            type:
              room.phase === "voting_confirmation" ? "runoff_vote" : "vote_cast",
            message: getVoteEventText(bot.name, targetPlayer.name, room.phase),
            visibility: "public",
            target_player_id: targetPlayer.id,
          });
        }
      })
    );
  }
}

async function resolveVotingPhase(
  room: RoomRecord,
  players: Player[],
  votes: Vote[],
  voteType: string,
  runoffCandidateIds: string[]
): Promise<void> {
  const alivePlayers = players.filter((player) => player.is_alive);

  if (votes.length <= Math.floor(alivePlayers.length / 2)) {
    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: room.phase,
      type: "voting_failed",
      message: "Недостаточно голосов. Никто не выбыл.",
      visibility: "public",
      target_player_id: null,
    });

    await updateRoomPhase(room.id, "night", {
      roundNumber: room.round_number + 1,
    });
    return;
  }

  const votesByTarget = votes.reduce<Record<string, number>>(
    (accumulator, vote) => {
      if (!vote.target_player_id) {
        return accumulator;
      }

      accumulator[vote.target_player_id] =
        (accumulator[vote.target_player_id] ?? 0) + 1;
      return accumulator;
    },
    {}
  );

  const sortedVotes = Object.entries(votesByTarget).sort(
    (left, right) => right[1] - left[1]
  );
  const highestVoteCount = sortedVotes[0]?.[1] ?? 0;
  const topTargetIds = sortedVotes
    .filter(([, count]) => count === highestVoteCount)
    .map(([targetId]) => targetId);

  if (topTargetIds.length > 1 && room.phase === "voting") {
    const tieNames = players
      .filter((player) => topTargetIds.includes(player.id))
      .map((player) => player.name)
      .join(", ");

    await Promise.all(
      topTargetIds.map((playerId) =>
        addGameEvent(room.id, {
          round_number: room.round_number,
          phase: "voting_confirmation",
          type: "runoff_candidate",
          message: "Кандидат на переголосование",
          visibility: "public",
          target_player_id: playerId,
        })
      )
    );

    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: "voting_confirmation",
      type: "runoff_started",
      message: `Ничья: ${tieNames}. Повторное голосование.`,
      visibility: "public",
      target_player_id: null,
    });
    await updateRoomPhase(room.id, "voting_confirmation");
    return;
  }

  if (topTargetIds.length > 1 && room.phase === "voting_confirmation") {
    await addGameEvent(room.id, {
      round_number: room.round_number,
      phase: "voting_confirmation",
      type: "runoff_failed",
      message:
        "Повторное голосование снова завершилось ничьей. Никто не выбыл.",
      visibility: "public",
      target_player_id: null,
    });
    await updateRoomPhase(room.id, "night", {
      roundNumber: room.round_number + 1,
    });
    return;
  }

  const eliminatedPlayerId = topTargetIds[0] ?? runoffCandidateIds[0];

  if (!eliminatedPlayerId) {
    return;
  }

  const eliminatedPlayer = players.find(
    (player) => player.id === eliminatedPlayerId
  );
  await killPlayer(eliminatedPlayerId);
  await addGameEvent(room.id, {
    round_number: room.round_number,
    phase: room.phase,
    type: "player_exiled",
    message: `${eliminatedPlayer?.name ?? "Игрок"} изгнан голосованием.`,
    visibility: "public",
    target_player_id: eliminatedPlayerId,
  });
  await addGameEvent(room.id, {
    round_number: room.round_number,
    phase: room.phase,
    type: "role_revealed",
    message: `Роль игрока ${eliminatedPlayer?.name ?? "Игрок"}: ${formatRole(
      eliminatedPlayer?.role ?? "civilian"
    )}.`,
    visibility: "public",
    target_player_id: eliminatedPlayerId,
  });

  await updateRoomPhase(room.id, "night", {
    roundNumber: room.round_number + 1,
  });
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

function buildRoleAssignments(
  players: Player[],
  settings: RoomRecord["settings"]
): Array<{ id: string; role: PlayerRole }> {
  if (settings.roleAssignmentMode === "manual") {
    return players.map((player) => ({
      id: player.id,
      role: player.role === "unassigned" ? "civilian" : player.role,
    }));
  }

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

function orderPlayers(
  players: Player[],
  localPlayerId: string | null
): Player[] {
  return [...players].sort((left, right) => {
    if (left.is_alive !== right.is_alive) {
      return left.is_alive ? -1 : 1;
    }

    if (left.id === localPlayerId && right.id !== localPlayerId) {
      return -1;
    }

    if (right.id === localPlayerId && left.id !== localPlayerId) {
      return 1;
    }

    return (
      new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime()
    );
  });
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

function isBotPlayer(player: Player): boolean {
  return !player.is_host && samplePlayerNames.includes(player.name);
}

async function chooseBotNightAction(
  room: RoomRecord,
  bot: Player,
  alivePlayers: Player[],
  gameEvents: GameEvent[],
  nightActions: NightAction[]
): Promise<{
  actionType: NightAction["action_type"];
  targetPlayerId: string;
} | null> {
  const roundNumber = room.round_number || 1;
  const suspicion = buildSuspicionMap(alivePlayers, gameEvents, []);
  const existingActorActions = nightActions.filter(
    (action) => action.actor_player_id === bot.id && action.round_number === roundNumber
  );

  if (bot.role === "mafia") {
    const alreadyActed = existingActorActions.some(
      (action) => action.action_type === "mafiaKill"
    );
    if (alreadyActed) {
      return null;
    }

    const target = rankPlayersForMafia(alivePlayers, suspicion).find((player) =>
      canTarget(bot, player)
    );

    return target
      ? {
          actionType: "mafiaKill",
          targetPlayerId: target.id,
        }
      : null;
  }

  if (bot.role === "doctor") {
    const alreadyActed = existingActorActions.some(
      (action) => action.action_type === "doctorHeal"
    );
    if (alreadyActed) {
      return null;
    }

    const selfHealCount = await getDoctorSelfHealCount(room.id, bot.id);
    const target = chooseDoctorTarget(
      bot,
      alivePlayers,
      suspicion,
      selfHealCount < room.settings.doctorSelfHealsLimit,
      gameEvents
    );

    return target
      ? {
          actionType: "doctorHeal",
          targetPlayerId: target.id,
        }
      : null;
  }

  if (bot.role === "inspector") {
    const hasCheck = existingActorActions.some(
      (action) => action.action_type === "detectiveCheck"
    );
    const hasKill = existingActorActions.some(
      (action) => action.action_type === "detectiveKill"
    );
    if (hasCheck || hasKill) {
      return null;
    }

    const rankedTargets = rankPlayersForInspector(alivePlayers, suspicion).filter(
      (player) => canTarget(bot, player)
    );
    const lethalTarget = rankedTargets[0];
    const shouldShoot =
      Boolean(lethalTarget) &&
      suspicion[lethalTarget.id] >= 7 &&
      alivePlayers.length <= 5;

    if (shouldShoot && lethalTarget) {
      return {
        actionType: "detectiveKill",
        targetPlayerId: lethalTarget.id,
      };
    }

    const checkTarget = rankedTargets[0];
    return checkTarget
      ? {
          actionType: "detectiveCheck",
          targetPlayerId: checkTarget.id,
        }
      : null;
  }

  return null;
}

function chooseBotVoteTarget(
  room: RoomRecord,
  bot: Player,
  alivePlayers: Player[],
  gameEvents: GameEvent[],
  votes: Vote[]
): string | null {
  const candidates =
    room.phase === "voting_confirmation"
      ? alivePlayers.filter((player) =>
          getRunoffCandidateIds(gameEvents, room.round_number).includes(player.id)
        )
      : alivePlayers.filter((player) => player.id !== bot.id);
  const suspicion = buildSuspicionMap(alivePlayers, gameEvents, votes);

  if (bot.role === "mafia") {
    const target = [...candidates]
      .filter((player) => player.role !== "mafia")
      .sort((left, right) => {
        const rightScore =
          (suspicion[right.id] ?? 0) + (right.role === "inspector" ? 3 : 0);
        const leftScore =
          (suspicion[left.id] ?? 0) + (left.role === "inspector" ? 3 : 0);
        return rightScore - leftScore;
      })[0];
    return target?.id ?? null;
  }

  const target = [...candidates]
    .filter((player) => player.id !== bot.id)
    .sort((left, right) => (suspicion[right.id] ?? 0) - (suspicion[left.id] ?? 0))[0];

  return target?.id ?? null;
}

function buildSuspicionMap(
  alivePlayers: Player[],
  gameEvents: GameEvent[],
  votes: Vote[]
): SuspicionMap {
  const suspicion = alivePlayers.reduce<SuspicionMap>((map, player) => {
    map[player.id] = 0;
    return map;
  }, {});

  const aliveIds = new Set(alivePlayers.map((player) => player.id));

  for (const vote of votes) {
    if (!vote.target_player_id || !aliveIds.has(vote.target_player_id)) {
      continue;
    }

    suspicion[vote.target_player_id] =
      (suspicion[vote.target_player_id] ?? 0) + 1;
  }

  for (const event of gameEvents) {
    if (!event.target_player_id || !aliveIds.has(event.target_player_id)) {
      continue;
    }

    if (event.type === "runoff_candidate") {
      suspicion[event.target_player_id] =
        (suspicion[event.target_player_id] ?? 0) + 2;
    }

    if (event.type === "night_saved") {
      suspicion[event.target_player_id] =
        (suspicion[event.target_player_id] ?? 0) + 2;
    }
  }

  const playerOrder = [...alivePlayers].sort(
    (left, right) =>
      new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime()
  );

  playerOrder.forEach((player, index) => {
    suspicion[player.id] = (suspicion[player.id] ?? 0) + index * 0.15;
  });

  return suspicion;
}

function rankPlayersForMafia(
  alivePlayers: Player[],
  suspicion: SuspicionMap
): Player[] {
  return [...alivePlayers]
    .filter((player) => player.role !== "mafia")
    .sort((left, right) => {
      const rightScore =
        (suspicion[right.id] ?? 0) +
        (right.role === "inspector" ? 5 : 0) +
        (right.role === "doctor" ? 3 : 0);
      const leftScore =
        (suspicion[left.id] ?? 0) +
        (left.role === "inspector" ? 5 : 0) +
        (left.role === "doctor" ? 3 : 0);
      return rightScore - leftScore;
    });
}

function rankPlayersForInspector(
  alivePlayers: Player[],
  suspicion: SuspicionMap
): Player[] {
  return [...alivePlayers]
    .filter((player) => player.role !== "inspector")
    .sort((left, right) => {
      const rightScore =
        (suspicion[right.id] ?? 0) +
        (right.role === "mafia" ? 1.5 : 0) +
        (isBotPlayer(right) ? 0.2 : 0);
      const leftScore =
        (suspicion[left.id] ?? 0) +
        (left.role === "mafia" ? 1.5 : 0) +
        (isBotPlayer(left) ? 0.2 : 0);
      return rightScore - leftScore;
    });
}

function chooseDoctorTarget(
  bot: Player,
  alivePlayers: Player[],
  suspicion: SuspicionMap,
  canSelfHeal: boolean,
  gameEvents: GameEvent[]
): Player | null {
  const recentlyThreatenedIds = new Set(
    gameEvents
      .filter((event) => event.type === "night_saved" && event.target_player_id)
      .slice(-3)
      .map((event) => event.target_player_id as string)
  );

  return [...alivePlayers]
    .filter((player) => player.id !== bot.id || canSelfHeal)
    .sort((left, right) => {
      const rightScore =
        (recentlyThreatenedIds.has(right.id) ? 5 : 0) +
        (right.role === "inspector" ? 4 : 0) +
        (right.role === "doctor" ? 2 : 0) -
        (suspicion[right.id] ?? 0);
      const leftScore =
        (recentlyThreatenedIds.has(left.id) ? 5 : 0) +
        (left.role === "inspector" ? 4 : 0) +
        (left.role === "doctor" ? 2 : 0) -
        (suspicion[left.id] ?? 0);
      return rightScore - leftScore;
    })[0] ?? null;
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

function getNightActionEventText(
  actionType: NightAction["action_type"]
): string {
  switch (actionType) {
    case "mafiaKill":
      return "Мафия вышла на охоту.";
    case "doctorHeal":
      return "Доктор вышел на спасение.";
    case "detectiveCheck":
      return "Инспектор начал расследование.";
    case "detectiveKill":
      return "Инспектор вышел на охоту.";
    default:
      return "Игрок совершил действие.";
  }
}

function isPublicNightAction(actionType: NightAction["action_type"]): boolean {
  return actionType !== "detectiveCheck";
}

function getVoteEventText(
  voterName: string,
  targetName: string,
  phase: RoomRecord["phase"]
): string {
  if (phase === "voting_confirmation") {
    return `${voterName} выбрал ${targetName} на переголосовании.`;
  }

  return `${voterName} выбрал ${targetName}.`;
}

function getActionConfirmation(
  actionType: NightAction["action_type"],
  playerName: string
): string {
  switch (actionType) {
    case "mafiaKill":
      return `Вы выбрали жертву: ${playerName}.`;
    case "doctorHeal":
      return `Вы выбрали спасение для ${playerName}.`;
    case "detectiveKill":
      return `Вы решили выстрелить в ${playerName}.`;
    default:
      return `Действие по цели ${playerName} сохранено.`;
  }
}

function getAdvanceButtonLabel(phase: RoomRecord["phase"]): string {
  switch (phase) {
    case "night":
      return "Завершить ночь";
    case "day":
      return "Начать голосование";
    case "voting":
      return "Подсчитать голоса";
    case "voting_confirmation":
      return "Завершить переголосование";
    default:
      return "Продолжить";
  }
}

function getPhaseEmoji(phase: RoomRecord["phase"]): string {
  switch (phase) {
    case "night":
      return "🌙";
    case "day":
      return "☀️";
    case "voting":
    case "voting_confirmation":
      return "🗳️";
    case "game_over":
      return "🏁";
    default:
      return "🎭";
  }
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
      return "Переголосование";
    case "game_over":
      return "Конец игры";
    default:
      return phase;
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

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getWinner(players: Player[]): "mafia" | "civilians" | null {
  const alivePlayers = players.filter((player) => player.is_alive);
  const aliveMafiaPlayers = alivePlayers.filter((player) => player.role === "mafia");
  const mafiaAlive = aliveMafiaPlayers.length;
  const civiliansAlive = alivePlayers.length - mafiaAlive;

  if (mafiaAlive === 0) {
    return "civilians";
  }

  if (
    mafiaAlive === 1 &&
    alivePlayers.length === 2 &&
    alivePlayers.some((player) => player.role === "inspector")
  ) {
    return null;
  }

  if (mafiaAlive >= civiliansAlive) {
    return "mafia";
  }

  return null;
}

function computeFinalScore(
  player: Player,
  winner: GameOutcome | null
): number {
  const belongsToWinner =
    (winner === "mafia" && player.role === "mafia") ||
    (winner === "civilians" && player.role !== "mafia") ||
    (winner === "doctor" && player.role === "doctor");

  return (
    player.score +
    (belongsToWinner ? 5 : 0) +
    (player.is_alive ? 2 : 0) +
    (player.is_host ? 1 : 0)
  );
}

function getGameOutcome(
  players: Player[],
  events: GameEvent[]
): GameOutcome | null {
  const latestGameOverEvent = [...events]
    .filter((event) => event.phase === "game_over")
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    )[0];

  switch (latestGameOverEvent?.type) {
    case "game_over_mafia":
      return "mafia";
    case "game_over_civilians":
      return "civilians";
    case "game_over_doctor":
      return "doctor";
    case "game_over_draw":
      return "draw";
    default:
      return getWinner(players);
  }
}

function parseChatMessageEvent(event: GameEvent): ChatMessage | null {
  try {
    const payload = JSON.parse(event.message) as {
      authorId?: string;
      authorName?: string;
      text?: string;
    };

    if (!payload.authorId || !payload.authorName || !payload.text) {
      return null;
    }

    return {
      id: event.id,
      authorId: payload.authorId,
      authorName: payload.authorName,
      text: payload.text,
      createdAt: event.created_at,
    };
  } catch {
    return null;
  }
}

function getGameOverMessage(winner: GameOutcome | null): string {
  switch (winner) {
    case "mafia":
      return "Победила мафия";
    case "civilians":
      return "Победили мирные";
    case "doctor":
      return "Доктор победил";
    case "draw":
      return "Ничья";
    default:
      return "Игра завершена";
  }
}

function getGameOverEventType(winner: GameOutcome): string {
  switch (winner) {
    case "mafia":
      return "game_over_mafia";
    case "civilians":
      return "game_over_civilians";
    case "doctor":
      return "game_over_doctor";
    case "draw":
      return "game_over_draw";
    default:
      return "game_over";
  }
}

function countAssignedRoles(players: Player[]): Record<PlayerRole, number> {
  return players.reduce<Record<PlayerRole, number>>(
    (counts, player) => {
      counts[player.role] += 1;
      return counts;
    },
    {
      unassigned: 0,
      mafia: 0,
      doctor: 0,
      inspector: 0,
      civilian: 0,
    }
  );
}

function getRoleLimit(
  role: PlayerRole,
  settings: RoomRecord["settings"],
  playerCount?: number
): number {
  switch (role) {
    case "mafia":
      return settings.roles.mafia;
    case "doctor":
      return settings.roles.doctors;
    case "inspector":
      return settings.roles.detectives;
    case "civilian": {
      if (typeof playerCount === "number") {
        return Math.max(
          0,
          playerCount -
            settings.roles.mafia -
            settings.roles.doctors -
            settings.roles.detectives
        );
      }

      return settings.roles.civilians;
    }
    default:
      return 0;
  }
}

function getManualRoleAssignmentError(
  targetPlayer: Player,
  role: PlayerRole,
  players: Player[],
  settings: RoomRecord["settings"]
): string | null {
  if (role === "unassigned") {
    return "Роль должна быть одной из игровых.";
  }

  if (targetPlayer.role === role) {
    return null;
  }

  const roleCounts = countAssignedRoles(players);
  const roleLimit = getRoleLimit(role, settings, players.length);

  if (roleCounts[role] >= roleLimit) {
    return `Для роли ${formatRole(role)} уже выбран максимум игроков.`;
  }

  return null;
}

function validateManualRoleAssignments(
  players: Player[],
  settings: RoomRecord["settings"]
): string | null {
  const roleCounts = countAssignedRoles(players);
  const effectiveRoleCounts: Record<PlayerRole, number> = {
    ...roleCounts,
    civilian: roleCounts.civilian + roleCounts.unassigned,
    unassigned: 0,
  };

  for (const role of ["mafia", "doctor", "inspector", "civilian"] as const) {
    if (
      effectiveRoleCounts[role] !==
      getRoleLimit(role, settings, players.length)
    ) {
      return `Количество ролей ${formatRole(role)} не совпадает с настройками.`;
    }
  }

  return null;
}

function getRunoffCandidateIds(
  events: GameEvent[],
  roundNumber: number
): string[] {
  const runoffEvents = events.filter(
    (event) =>
      event.round_number === roundNumber && event.type === "runoff_candidate"
  );

  return runoffEvents
    .map((event) => event.target_player_id)
    .filter((playerId): playerId is string => Boolean(playerId));
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
