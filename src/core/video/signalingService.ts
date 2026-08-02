import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";
import type { VideoSignal } from "./videoTypes";

export type SignalType = VideoSignal["signal_type"];

export async function sendVideoSignal(
  roomId: string,
  senderUserId: string,
  receiverUserId: string,
  signalType: SignalType,
  payload: VideoSignal["payload"]
): Promise<void> {
  const { error } = await getSupabaseClient().from("mafia_video_signals").insert({
    room_id: roomId,
    sender_user_id: senderUserId,
    receiver_user_id: receiverUserId,
    signal_type: signalType,
    payload,
  });
  if (error) throw new Error("Не удалось передать данные видеосвязи");
}

export function subscribeToVideoSignals(
  roomId: string,
  userId: string,
  onSignal: (signal: VideoSignal) => void,
  onParticipantChange: () => void
): RealtimeChannel {
  const client = getSupabaseClient();
  const channel = client.channel(`mafia-video:${roomId}:${userId}`);
  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "mafia_video_signals", filter: `receiver_user_id=eq.${userId}` },
    (payload) => onSignal(payload.new as VideoSignal)
  );
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "mafia_video_sessions", filter: `room_id=eq.${roomId}` },
    onParticipantChange
  );
  return channel.subscribe();
}

export async function closeSignalSubscription(channel: RealtimeChannel | null): Promise<void> {
  if (channel) await getSupabaseClient().removeChannel(channel);
}
