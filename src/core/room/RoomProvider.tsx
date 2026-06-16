import React from "react";
import { getGameEvents } from "../../services/gameService";
import { getPlayers } from "../player/playerService";
import {
  subscribeToEvents,
  subscribeToPlayers,
  subscribeToRoom,
  unsubscribe,
} from "../supabase/realtime";
import type { GameEvent, Player } from "../supabase/database.types";
import { getSessionSnapshot } from "../../utils/storage";
import { getPlatformRoomByCode } from "./roomService";
import type { PlatformRoom } from "./roomTypes";
import { setIfChanged } from "../../utils/state";

type RoomContextValue = {
  room: PlatformRoom | null;
  players: Player[];
  events: GameEvent[];
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const RoomContext = React.createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomCode,
  children,
}: {
  roomCode?: string;
  children: React.ReactNode;
}) {
  const session = getSessionSnapshot();
  const effectiveRoomCode = roomCode ?? session.roomCode ?? "";
  const [room, setRoom] = React.useState<PlatformRoom | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [events, setEvents] = React.useState<GameEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!effectiveRoomCode) {
      setIfChanged(setRoom, null);
      setIfChanged(setPlayers, []);
      setIfChanged(setEvents, []);
      setIsLoading(false);
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
    }

    const nextRoom = await getPlatformRoomByCode(effectiveRoomCode);

    if (!nextRoom) {
      setIfChanged(setRoom, null);
      setIfChanged(setPlayers, []);
      setIfChanged(setEvents, []);
      setIsLoading(false);
      return;
    }

    const [nextPlayers, nextEvents] = await Promise.all([
      getPlayers(nextRoom.id),
      getGameEvents(nextRoom.id),
    ]);

    setIfChanged(setRoom, nextRoom);
    setIfChanged(setPlayers, nextPlayers);
    setIfChanged(setEvents, nextEvents);
    setIsLoading(false);
  }, [effectiveRoomCode]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!room?.id) {
      return undefined;
    }

    const roomChannel = subscribeToRoom(room.id, (payload) => {
      if (payload.new) {
        setIfChanged(setRoom, payload.new as PlatformRoom);
      }

      void refresh({ silent: true });
    });
    const playersChannel = subscribeToPlayers(room.id, async () => {
      const nextPlayers = await getPlayers(room.id);
      setIfChanged(setPlayers, nextPlayers);
    });
    const eventsChannel = subscribeToEvents(room.id, async () => {
      const nextEvents = await getGameEvents(room.id);
      setIfChanged(setEvents, nextEvents);
    });

    return () => {
      unsubscribe(roomChannel);
      unsubscribe(playersChannel);
      unsubscribe(eventsChannel);
    };
  }, [refresh, room?.id]);

  return (
    <RoomContext.Provider value={{ room, players, events, isLoading, refresh }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomContext() {
  const context = React.useContext(RoomContext);

  if (!context) {
    throw new Error("useRoomContext must be used within RoomProvider");
  }

  return context;
}
