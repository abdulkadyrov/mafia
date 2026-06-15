import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type {
  GameEvent,
  NightAction,
  Player,
  Room,
  Vote,
} from "../types/database";

type TableName =
  | "rooms"
  | "players"
  | "game_events"
  | "night_actions"
  | "votes";

function subscribeToTable<T extends Record<string, unknown>>(
  channelName: string,
  table: TableName,
  filter: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void
): RealtimeChannel {
  const channel = supabase.channel(channelName);

  channel.on(
    "postgres_changes" as "postgres_changes",
    {
      event: "*",
      schema: "public",
      table,
      filter,
    },
    (payload) => {
      callback(payload as RealtimePostgresChangesPayload<T>);
    }
  );

  return channel.subscribe();
}

export function subscribeToRoom(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<Room>) => void
): RealtimeChannel {
  return subscribeToTable(
    `room:${roomId}`,
    "rooms",
    `id=eq.${roomId}`,
    callback
  );
}

export function subscribeToPlayers(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<Player>) => void
): RealtimeChannel {
  return subscribeToTable(
    `players:${roomId}`,
    "players",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function subscribeToEvents(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<GameEvent>) => void
): RealtimeChannel {
  return subscribeToTable(
    `events:${roomId}`,
    "game_events",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function subscribeToNightActions(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<NightAction>) => void
): RealtimeChannel {
  return subscribeToTable(
    `night-actions:${roomId}`,
    "night_actions",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function subscribeToVotes(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<Vote>) => void
): RealtimeChannel {
  return subscribeToTable(
    `votes:${roomId}`,
    "votes",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function unsubscribe(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel);
}
