import React from "react";
import { mafiaCommands } from "../game/gameCommands";
import { joinMafiaRoom } from "./mafiaRoomService";
import { subscribeToMafiaRoom, unsubscribeFromMafiaRoom } from "./mafiaRoomRealtime";
import type { MafiaChatMessage, MafiaEvent, MafiaGameRecord, MafiaPlayerView, MafiaRoomRecord, MafiaSnapshot } from "./mafiaRoomTypes";

type MafiaRoomContextValue = {
  snapshot: MafiaSnapshot | null;
  isLoading: boolean;
  error: string;
  realtimeStatus: string;
  refresh: () => Promise<void>;
  applySnapshot: (snapshot: MafiaSnapshot) => void;
  clearError: () => void;
};

const MafiaRoomContext = React.createContext<MafiaRoomContextValue | null>(null);

export function MafiaRoomProvider({ roomCode, children }: { roomCode: string; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = React.useState<MafiaSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [realtimeStatus, setRealtimeStatus] = React.useState("CONNECTING");
  const snapshotRef = React.useRef<MafiaSnapshot | null>(null);

  const applySnapshot = React.useCallback((next: MafiaSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    setError("");
  }, []);

  const refresh = React.useCallback(async () => {
    const roomId = snapshotRef.current?.room.id;
    try {
      const next = roomId ? await mafiaCommands.snapshot(roomId) : await joinMafiaRoom(roomCode);
      applySnapshot(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить комнату");
      throw caught;
    }
  }, [applySnapshot, roomCode]);

  const patchSnapshot = React.useCallback((updater: (current: MafiaSnapshot) => MafiaSnapshot) => {
    setSnapshot((current) => {
      if (!current) return current;
      const next = updater(current);
      snapshotRef.current = next;
      return next;
    });
  }, []);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    void joinMafiaRoom(roomCode)
      .then((next) => { if (active) applySnapshot(next); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Комната не найдена"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [applySnapshot, roomCode]);

  React.useEffect(() => {
    const roomId = snapshot?.room.id;
    if (!roomId) return undefined;
    const channel = subscribeToMafiaRoom(roomId, {
      onRoom: (room: MafiaRoomRecord) => patchSnapshot((current) => ({ ...current, room })),
      onPlayer: (player: MafiaPlayerView, event) => patchSnapshot((current) => ({
        ...current,
        players: event === "DELETE"
          ? current.players.filter((item) => item.id !== player.id)
          : upsertPlayer(current.players, player),
      })),
      onGame: (game: MafiaGameRecord, event) => {
        const currentGame = snapshotRef.current?.game;
        if (event === "INSERT" || game.status === "finished" || currentGame?.id !== game.id) {
          void refresh().catch(() => undefined);
          return;
        }
        patchSnapshot((current) => ({ ...current, game }));
      },
      onEvent: (event: MafiaEvent) => patchSnapshot((current) => ({
        ...current,
        events: appendUnique(current.events, event, 250),
      })),
      onMessage: (message: MafiaChatMessage) => patchSnapshot((current) => ({
        ...current,
        messages: appendUnique(current.messages, message, 250),
      })),
      onStatus: setRealtimeStatus,
    });
    return () => { void unsubscribeFromMafiaRoom(channel); };
  }, [patchSnapshot, refresh, snapshot?.room.id]);

  const value = React.useMemo(() => ({
    snapshot,
    isLoading,
    error,
    realtimeStatus,
    refresh,
    applySnapshot,
    clearError: () => setError(""),
  }), [applySnapshot, error, isLoading, realtimeStatus, refresh, snapshot]);
  return <MafiaRoomContext.Provider value={value}>{children}</MafiaRoomContext.Provider>;
}

export function useMafiaRoomContext() {
  const value = React.useContext(MafiaRoomContext);
  if (!value) throw new Error("useMafiaRoom должен использоваться внутри MafiaRoomProvider");
  return value;
}

function upsertPlayer(players: MafiaPlayerView[], patch: MafiaPlayerView): MafiaPlayerView[] {
  const index = players.findIndex((player) => player.id === patch.id);
  if (index < 0) return [...players, patch];
  const next = [...players];
  next[index] = { ...players[index], ...patch, role: patch.role ?? players[index].role, team: patch.team ?? players[index].team };
  return next;
}

function appendUnique<T extends { id: string | number }>(items: T[], item: T, maximum: number): T[] {
  if (items.some((candidate) => candidate.id === item.id)) return items;
  return [...items, item].slice(-maximum);
}
