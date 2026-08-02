import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";
import type { MafiaChatMessage, MafiaEvent, MafiaGameRecord, MafiaPlayerView, MafiaRoomRecord } from "./mafiaRoomTypes";

type RealtimeHandlers = {
  onRoom: (row: MafiaRoomRecord) => void;
  onPlayer: (row: MafiaPlayerView, event: "INSERT" | "UPDATE" | "DELETE") => void;
  onGame: (row: MafiaGameRecord, event: "INSERT" | "UPDATE" | "DELETE") => void;
  onEvent: (row: MafiaEvent) => void;
  onMessage: (row: MafiaChatMessage) => void;
  onStatus?: (status: string) => void;
};

export function subscribeToMafiaRoom(roomId: string, handlers: RealtimeHandlers): RealtimeChannel {
  const client = getSupabaseClient();
  const channel = client.channel(`mafia-room:${roomId}`);
  listen(channel, "mafia_rooms", `id=eq.${roomId}`, (payload) => {
    if (payload.new) handlers.onRoom(payload.new as MafiaRoomRecord);
  });
  listen(channel, "mafia_room_players", `room_id=eq.${roomId}`, (payload) => {
    const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as MafiaPlayerView;
    handlers.onPlayer(row, payload.eventType);
  });
  listen(channel, "mafia_games", `room_id=eq.${roomId}`, (payload) => {
    const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as MafiaGameRecord;
    handlers.onGame(row, payload.eventType);
  });
  listen(channel, "mafia_game_events", `room_id=eq.${roomId}`, (payload) => {
    if (payload.eventType === "INSERT") handlers.onEvent(payload.new as MafiaEvent);
  });
  listen(channel, "mafia_chat_messages", `room_id=eq.${roomId}`, (payload) => {
    if (payload.eventType === "INSERT") handlers.onMessage(payload.new as MafiaChatMessage);
  });
  channel.subscribe((status) => handlers.onStatus?.(status));
  return channel;
}

export async function unsubscribeFromMafiaRoom(channel: RealtimeChannel): Promise<void> {
  await getSupabaseClient().removeChannel(channel);
}

function listen(
  channel: RealtimeChannel,
  table: string,
  filter: string,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
) {
  return channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, callback);
}
