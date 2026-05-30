import React from "react";
import { motion } from "framer-motion";
import { PlayerActionPanel } from "../features/game-actions/PlayerActionPanel";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import {
  addPlayer,
  assignPlayerRole,
  createInitialSnapshot,
  moveToDiscussion,
  moveToNextNight,
  moveToVoting,
  resolveConfirmation,
  resolveNight,
  resolveVotes,
  seedDemoPlayers,
  startGame,
  submitConfirmationVote,
  submitNightAction,
  submitVote,
  updateRoomSettings,
} from "../game/engine";
import { createId } from "../game/id";
import { samplePlayerNames } from "../game/defaults";
import { useCountdown } from "../hooks/useCountdown";
import { ClientNetwork } from "../network/ClientNetwork";
import { HostNetwork } from "../network/HostNetwork";
import {
  isLanRelayMode,
  LanRelayClientNetwork,
  LanRelayHostNetwork,
} from "../network/LanRelayNetwork";
import { createRoomPeerId, generateQRCode } from "../network/RoomService";
import { saveArchivedGame } from "../services/storage/GameArchiveService";
import { createHashAppPath } from "../shared/routing/basePath";
import { Button } from "../shared/ui/Button";
import { GameOverPanel } from "../widgets/GameOverPanel";
import { SystemFeed } from "../widgets/SystemFeed";
import {
  ClientAction,
  GamePhase,
  GameSnapshot,
  PlayerId,
  Role,
  RoomSettings,
  phaseLabels,
  roleLabels,
} from "../types/game";

type Props = {
  onLeave: () => void;
  roomCode: string;
  settings: RoomSettings;
  developerMode: boolean;
  playerName: string;
  joinPeerId?: string;
};

type HostConnection = HostNetwork | LanRelayHostNetwork;
type ClientConnection = ClientNetwork | LanRelayClientNetwork;

export const Room: React.FC<Props> = ({
  onLeave,
  roomCode,
  settings,
  developerMode,
  playerName,
  joinPeerId,
}) => {
  const isClient = Boolean(joinPeerId);
  const localPlayerId = React.useMemo(() => createId("player"), []);
  const [displayName, setDisplayName] = React.useState(playerName);
  const [snapshot, setSnapshot] = React.useState<GameSnapshot>(() => {
    const initialSnapshot = createInitialSnapshot({ roomCode, settings });

    if (isClient) return initialSnapshot;

    return addPlayer(initialSnapshot, {
      id: localPlayerId,
      name: playerName || "Хост",
      isHost: true,
    });
  });
  const [inviteQr, setInviteQr] = React.useState<string>();
  const useLanRelay = isLanRelayMode();
  const [networkStatus, setNetworkStatus] = React.useState<
    "idle" | "hosting" | "connecting" | "connected" | "failed"
  >("idle");
  const [networkMessage, setNetworkMessage] = React.useState("");
  const [selectedPlayerId, setSelectedPlayerId] =
    React.useState<PlayerId>(localPlayerId);
  const hostRef = React.useRef<HostConnection>();
  const clientRef = React.useRef<ClientConnection>();
  const snapshotRef = React.useRef(snapshot);
  const secondsLeft = useCountdown(snapshot.phaseEndsAt);
  const selfPlayer =
    snapshot.players.find((player) => player.id === localPlayerId) ??
    snapshot.players[0];

  React.useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  React.useEffect(() => {
    if (isClient || !displayName.trim()) return undefined;

    const host = useLanRelay
      ? new LanRelayHostNetwork(
          roomCode,
          () => snapshotRef.current,
          (_peerId, action: ClientAction) => {
            setSnapshot((currentSnapshot) =>
              applyClientAction(currentSnapshot, action)
            );
          }
        )
      : new HostNetwork(
          roomCode,
          () => snapshotRef.current,
          (_peerId, action: ClientAction) => {
            setSnapshot((currentSnapshot) =>
              applyClientAction(currentSnapshot, action)
            );
          }
        );

    hostRef.current = host;
    host
      .start()
      .then(async (peerId) => {
        setNetworkStatus("hosting");
        setNetworkMessage(
          useLanRelay
            ? "LAN-сервер готов. Подключайте телефон по этому же адресу."
            : `Комната готова: ${peerId}`
        );
        const inviteUrl = `${location.origin}${createHashAppPath(
          `/room/${roomCode}`
        )}?peer=${encodeURIComponent(peerId)}`;
        setInviteQr(await generateQRCode(inviteUrl));
      })
      .catch((error) => {
        setNetworkStatus("failed");
        setNetworkMessage(
          error instanceof Error ? error.message : "Не удалось создать комнату"
        );
      });

    return () => {
      host.stop();
      hostRef.current = undefined;
    };
  }, [displayName, isClient, roomCode, useLanRelay]);

  React.useEffect(() => {
    if (!joinPeerId || !displayName.trim()) return undefined;

    setNetworkStatus("connecting");
    setNetworkMessage("Подключение к комнате...");

    const client = useLanRelay
      ? new LanRelayClientNetwork(
          (remoteSnapshot) => {
            setSnapshot(remoteSnapshot);
          },
          (message) => {
            setNetworkStatus("failed");
            setNetworkMessage(message);
          }
        )
      : new ClientNetwork(
          (remoteSnapshot) => {
            setSnapshot(remoteSnapshot);
          },
          (message) => {
            setNetworkStatus("failed");
            setNetworkMessage(message);
          }
        );

    clientRef.current = client;
    client
      .join(useLanRelay ? joinPeerId : createRoomPeerId(joinPeerId))
      .then(() => {
        setNetworkStatus("connected");
        setNetworkMessage("Подключено");
        client.sendAction({
          type: "joinRoom",
          playerId: localPlayerId,
          playerName: displayName.trim(),
        });
      })
      .catch((error) => {
        setNetworkStatus("failed");
        setNetworkMessage(
          error instanceof Error
            ? error.message
            : "Не удалось подключиться к комнате"
        );
      });

    return () => {
      client.destroy();
      clientRef.current = undefined;
    };
  }, [displayName, joinPeerId, localPlayerId, useLanRelay]);

  React.useEffect(() => {
    if (!isClient) {
      hostRef.current?.broadcastSnapshot();
    }

    if (snapshot.phase === "GameOver") {
      saveArchivedGame(snapshot).catch(() => undefined);
    }
  }, [isClient, snapshot]);

  function updateHostSnapshot(
    updater: (currentSnapshot: GameSnapshot) => GameSnapshot
  ) {
    if (isClient) return;
    setSnapshot((currentSnapshot) => updater(currentSnapshot));
  }

  function sendAction(action: ClientAction) {
    if (isClient) {
      clientRef.current?.sendAction(action);
      return;
    }

    setSnapshot((currentSnapshot) =>
      applyClientAction(currentSnapshot, action)
    );
  }

  if (!displayName.trim()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-5 text-zinc-950">
        <form
          className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)]"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const name = String(formData.get("name") ?? "").trim();
            if (!name) return;
            window.localStorage.setItem(
              "mafia-player-name",
              JSON.stringify(name)
            );
            setDisplayName(name);
          }}
        >
          <h1 className="text-center text-4xl font-black">Мафия</h1>
          <input
            name="name"
            autoFocus
            placeholder="Ваше имя"
            className="mt-4 h-14 w-full rounded-lg border border-zinc-200 bg-white px-4 text-lg font-bold text-zinc-950 outline-none focus:border-zinc-950"
          />
          <Button className="mt-4 w-full" variant="primary">
            Войти
          </Button>
        </form>
      </main>
    );
  }

  return (
    <motion.main
      animate={{ background: getPhaseBackground(snapshot.phase) }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      className={[
        "grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden px-3 py-4 sm:px-6",
        isLightPhase(snapshot.phase) ? "text-zinc-950" : "text-white",
      ].join(" ")}
    >
      <header
        className={[
          "mx-auto flex w-full max-w-6xl items-center justify-between gap-3 border-b pb-3",
          isLightPhase(snapshot.phase) ? "border-zinc-200" : "border-white/15",
        ].join(" ")}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-55">
            {phaseLabels[snapshot.phase]}
          </p>
          <p className="font-mono text-xl font-black tracking-[0.12em]">
            {roomCode}
          </p>
          <p className="text-xs font-bold opacity-60">
            {isClient
              ? getNetworkLabel(networkStatus)
              : "Администратор · Wi-Fi / точка доступа"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {inviteQr && !isClient ? (
            <img
              src={inviteQr}
              alt="QR"
              className="h-14 w-14 rounded-lg bg-white p-1"
            />
          ) : null}
          <Button
            variant="ghost"
            className="h-11 min-h-0 px-3 py-2"
            onClick={onLeave}
          >
            Выйти
          </Button>
        </div>
      </header>

      <section className="mx-auto grid min-h-0 w-full max-w-6xl grid-rows-[auto_1fr] gap-4 py-4">
        <div className="text-center">
          <motion.p
            key={snapshot.phase}
            initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="text-3xl font-black uppercase tracking-tight sm:text-4xl"
          >
            {getPhaseIcon(snapshot.phase)} {phaseLabels[snapshot.phase]}
          </motion.p>
          <p className="mt-2 font-mono text-5xl font-black tabular-nums sm:text-6xl">
            {formatTimer(secondsLeft)}
          </p>
        </div>

        {snapshot.phase === "Lobby" ? (
          <div className="grid min-h-0 gap-4 overflow-auto lg:grid-cols-[1fr_1.1fr]">
            <div className="grid content-start gap-3">
              <NetworkNotice
                isClient={isClient}
                roomCode={roomCode}
                networkStatus={networkStatus}
                networkMessage={networkMessage}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={isClient}
                  onClick={() =>
                    updateHostSnapshot((current) =>
                      seedDemoPlayers(current, samplePlayerNames)
                    )
                  }
                >
                  ♟ Игроки
                </Button>
                <Button
                  variant="primary"
                  disabled={isClient || snapshot.players.length < 4}
                  onClick={() => updateHostSnapshot(startGame)}
                >
                  ▶ Старт
                </Button>
              </div>
              <PlayerStrip
                snapshot={snapshot}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                developerMode={
                  developerMode ||
                  snapshot.settings.roleAssignmentMode === "manual"
                }
                disabled={isClient}
                onAssignRole={(playerId, role) =>
                  updateHostSnapshot((current) =>
                    assignPlayerRole(current, playerId, role)
                  )
                }
              />
            </div>
            <RoomSettingsForm
              settings={snapshot.settings}
              onChange={(nextSettings) =>
                updateHostSnapshot((current) =>
                  updateRoomSettings(current, nextSettings)
                )
              }
            />
          </div>
        ) : selfPlayer ? (
          <div className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-h-0 overflow-auto rounded-2xl border border-zinc-200 bg-white/92 p-3 text-zinc-950 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <GameOverPanel snapshot={snapshot} />
              {snapshot.phase !== "GameOver" ? (
                <PlayerActionPanel
                  snapshot={snapshot}
                  selfPlayer={selfPlayer}
                  selectedPlayerId={selectedPlayerId}
                  developerMode={developerMode}
                  onSelectPlayer={setSelectedPlayerId}
                  onNightAction={(type, targetId) => {
                    sendAction({
                      type: "nightAction",
                      action: {
                        actorId: selfPlayer.id,
                        targetId,
                        type,
                      },
                    });
                  }}
                  onVote={(vote) => {
                    sendAction({
                      type: "vote",
                      vote,
                    });
                  }}
                  onConfirmationVote={(vote) => {
                    sendAction({
                      type: "confirmationVote",
                      vote,
                    });
                  }}
                />
              ) : null}
            </div>
            <div className="min-h-0 overflow-auto">
              <SystemFeed snapshot={snapshot} selfPlayerId={selfPlayer.id} />
            </div>
          </div>
        ) : null}
      </section>

      <footer className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:grid-cols-6">
        <PhaseButton
          phase={snapshot.phase}
          target="Night"
          disabled={isClient || snapshot.phase !== "Night"}
          onClick={() => updateHostSnapshot(resolveNight)}
        >
          ◐ Ночь
        </PhaseButton>
        <PhaseButton
          phase={snapshot.phase}
          target="Discussion"
          disabled={
            isClient ||
            !["NightResults", "VoteResults"].includes(snapshot.phase)
          }
          onClick={() =>
            updateHostSnapshot(
              snapshot.phase === "NightResults"
                ? moveToDiscussion
                : moveToNextNight
            )
          }
        >
          ☀ День/Ночь
        </PhaseButton>
        <PhaseButton
          phase={snapshot.phase}
          target="Voting"
          disabled={isClient || snapshot.phase !== "Discussion"}
          onClick={() => updateHostSnapshot(moveToVoting)}
        >
          ▣ Голос
        </PhaseButton>
        {snapshot.phase === "Voting" ? (
          <Button
            className="col-span-3 sm:col-span-1"
            variant="primary"
            disabled={isClient}
            onClick={() => updateHostSnapshot(resolveVotes)}
          >
            ✓ Завершить
          </Button>
        ) : null}
        {snapshot.phase === "Confirmation" ? (
          <Button
            className="col-span-3 sm:col-span-1"
            variant="primary"
            disabled={isClient}
            onClick={() => updateHostSnapshot(resolveConfirmation)}
          >
            ⚖ Подтвердить
          </Button>
        ) : null}
        {snapshot.phase !== "Lobby" ? (
          <Button
            className="col-span-3 sm:col-span-1"
            variant="ghost"
            disabled={isClient}
            onClick={() => updateHostSnapshot(startGame)}
          >
            ↻ Рестарт
          </Button>
        ) : null}
      </footer>
    </motion.main>
  );
};

function PlayerStrip({
  snapshot,
  selectedPlayerId,
  developerMode,
  disabled,
  onSelectPlayer,
  onAssignRole,
}: {
  snapshot: GameSnapshot;
  selectedPlayerId?: PlayerId;
  developerMode: boolean;
  disabled: boolean;
  onSelectPlayer: (playerId: PlayerId) => void;
  onAssignRole: (playerId: PlayerId, role: Role) => void;
}) {
  return (
    <div className="grid max-h-72 gap-2 overflow-auto rounded-2xl border border-zinc-200 bg-white/85 p-2 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
      {snapshot.players.map((player) => (
        <div
          key={player.id}
          className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-zinc-50 p-1"
        >
          <button
            className={[
              "min-w-0 rounded-md px-3 py-2 text-left font-bold transition",
              selectedPlayerId === player.id
                ? "bg-zinc-950 text-white"
                : "text-zinc-950 hover:bg-white",
            ].join(" ")}
            onClick={() => onSelectPlayer(player.id)}
          >
            <span className="block truncate">{player.name}</span>
            {developerMode ? (
              <span className="block text-xs opacity-70">
                {roleLabels[player.role]}
              </span>
            ) : null}
          </button>
          {developerMode ? (
            <select
              value={player.role}
              disabled={disabled}
              onChange={(event) =>
                onAssignRole(player.id, event.target.value as Role)
              }
              className="rounded-md border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-950 outline-none"
            >
              {(Object.keys(roleLabels) as Role[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PhaseButton({
  phase,
  target,
  children,
  disabled,
  onClick,
}: {
  phase: GamePhase;
  target: GamePhase;
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={phase === target ? "primary" : "secondary"}
      disabled={disabled}
      className="h-11 min-h-0 px-2 py-2"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function NetworkNotice({
  isClient,
  roomCode,
  networkStatus,
  networkMessage,
}: {
  isClient: boolean;
  roomCode: string;
  networkStatus: "idle" | "hosting" | "connecting" | "connected" | "failed";
  networkMessage: string;
}) {
  if (!isClient && networkStatus !== "failed") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/92 px-4 py-3 text-zinc-950 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-black">Код комнаты</p>
        <p className="mt-1 font-mono text-3xl font-black tracking-[0.16em]">
          {roomCode}
        </p>
        <p className="mt-2 text-xs font-bold text-zinc-500">
          Подключите игроков к той же Wi-Fi сети или точке доступа. Адрес
          сервера показан в терминале npm run lan.
        </p>
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3 shadow-[0_18px_70px_rgba(15,23,42,0.08)]",
        networkStatus === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-zinc-200 bg-white/92 text-zinc-950",
      ].join(" ")}
    >
      <p className="text-sm font-black">{getNetworkLabel(networkStatus)}</p>
      <p className="mt-1 text-xs font-bold opacity-65">
        {networkMessage || "Ожидание соединения"}
      </p>
    </div>
  );
}

function getNetworkLabel(
  status: "idle" | "hosting" | "connecting" | "connected" | "failed"
): string {
  if (status === "hosting") return "Комната создана";
  if (status === "connecting") return "Подключение";
  if (status === "connected") return "Подключено";
  if (status === "failed") return "Ошибка сети";
  return "Ожидание";
}

function applyClientAction(
  snapshot: GameSnapshot,
  action: ClientAction
): GameSnapshot {
  if (action.type === "joinRoom") {
    const alreadyJoined = snapshot.players.some(
      (player) => player.id === action.playerId
    );
    if (alreadyJoined) return snapshot;

    return addPlayer(snapshot, {
      id: action.playerId,
      name: action.playerName,
    });
  }

  if (action.type === "nightAction")
    return submitNightAction(snapshot, action.action);
  if (action.type === "vote") return submitVote(snapshot, action.vote);
  if (action.type === "confirmationVote")
    return submitConfirmationVote(snapshot, action.vote);

  return snapshot;
}

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getPhaseBackground(phase: GamePhase): string {
  if (phase === "Night")
    return "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 26rem), linear-gradient(180deg, #020304 0%, #090B0D 100%)";
  if (
    phase === "Discussion" ||
    phase === "Voting" ||
    phase === "Confirmation" ||
    phase === "VoteResults" ||
    phase === "NightResults"
  ) {
    return "linear-gradient(180deg, #FAFAFA 0%, #EFEFED 100%)";
  }
  if (phase === "GameOver")
    return "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.09), transparent 24rem), linear-gradient(180deg, #040404 0%, #111111 100%)";
  return "linear-gradient(180deg, #FAFAFA 0%, #EFEFED 100%)";
}

function isLightPhase(phase: GamePhase): boolean {
  return !["Night", "GameOver"].includes(phase);
}

function getPhaseIcon(phase: GamePhase): string {
  if (phase === "Night") return "☾";
  if (phase === "Voting") return "▣";
  if (phase === "Confirmation") return "⚖";
  if (phase === "GameOver") return "☠";
  return "☀";
}
