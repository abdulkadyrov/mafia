import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import type {
  GameEvent,
  NightAction,
  Player,
  Room,
  Vote,
} from "../types/database";
import type { Team } from "../core/teams/teamTypes";
import type { GamePackRecord, GameStateRecord } from "../core/games/gameStateService";
import type { ScoreEvent } from "../core/score/scoreTypes";

type TableName =
  | "rooms"
  | "players"
  | "game_events"
  | "night_actions"
  | "votes"
  | "teams"
  | "game_packs"
  | "game_state"
  | "score_events";

function subscribeToTable<T extends Record<string, unknown>>(
  channelName: string,
  table: TableName,
  filter: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void
): RealtimeChannel {
  const supabase = getSupabaseClient();
  const uniqueChannelName =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `${channelName}:${crypto.randomUUID()}`
      : `${channelName}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const channel = supabase.channel(uniqueChannelName);

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

export function subscribeToTeams(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<Team>) => void
): RealtimeChannel {
  return subscribeToTable(`teams:${roomId}`, "teams", `room_id=eq.${roomId}`, callback);
}

export function subscribeToGamePacks(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<GamePackRecord>) => void
): RealtimeChannel {
  return subscribeToTable(
    `game-packs:${roomId}`,
    "game_packs",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function subscribeToGameState(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<GameStateRecord>) => void
): RealtimeChannel {
  return subscribeToTable(
    `game-state:${roomId}`,
    "game_state",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function subscribeToScoreEvents(
  roomId: string,
  callback: (payload: RealtimePostgresChangesPayload<ScoreEvent>) => void
): RealtimeChannel {
  return subscribeToTable(
    `score-events:${roomId}`,
    "score_events",
    `room_id=eq.${roomId}`,
    callback
  );
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = getSupabaseClient();
  void supabase.removeChannel(channel);
}
