import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";
import type { ChatChannel } from "../chat/chatTypes";
import type { NightActionType } from "./gameTypes";
import type { MafiaRoomSettings, MafiaSnapshot } from "../room/mafiaRoomTypes";

type CommandEnvelope<T> = { data: T; replayed?: boolean };

export async function invokeMafiaCommand<T>(
  command: Record<string, unknown> & { type: string },
  commandId = crypto.randomUUID()
): Promise<T> {
  const { data, error } = await getSupabaseClient().functions.invoke<CommandEnvelope<T>>("mafia-command", {
    body: { ...command, commandId },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json() as { error?: string };
        throw new Error(body.error || "Игровой сервер отклонил команду");
      } catch (caught) {
        if (caught instanceof Error && caught !== error) throw caught;
      }
    }
    throw new Error("Игровой сервер временно недоступен");
  }
  if (!data) throw new Error("Игровой сервер вернул пустой ответ");
  return data.data;
}

export const mafiaCommands = {
  snapshot: (roomId: string) => invokeMafiaCommand<MafiaSnapshot>({ type: "snapshot", roomId }),
  startGame: (roomId: string) => invokeMafiaCommand<MafiaSnapshot>({ type: "start_game", roomId }),
  acknowledgeRole: (roomId: string) => invokeMafiaCommand<MafiaSnapshot>({ type: "acknowledge_role", roomId }),
  nightAction: (roomId: string, actionType: NightActionType, targetGamePlayerId: string) =>
    invokeMafiaCommand<{ accepted: true }>({ type: "night_action", roomId, actionType, targetGamePlayerId }),
  vote: (roomId: string, targetGamePlayerId: string) =>
    invokeMafiaCommand<{ accepted: true }>({ type: "vote", roomId, targetGamePlayerId }),
  advancePhase: (roomId: string, expectedVersion: number) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "advance_phase", roomId, expectedVersion }),
  rematch: (roomId: string) => invokeMafiaCommand<MafiaSnapshot>({ type: "rematch", roomId }),
  sendChat: (roomId: string, channel: ChatChannel, content: string, clientNonce = crypto.randomUUID()) =>
    invokeMafiaCommand({ type: "send_chat", roomId, channel, content, clientNonce }),
  setReady: (roomId: string, ready: boolean) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "set_ready", roomId, ready }),
  setMediaStatus: (
    roomId: string,
    cameraEnabled: boolean,
    microphoneEnabled: boolean,
    connectionQuality: string
  ) => invokeMafiaCommand({ type: "set_media_status", roomId, cameraEnabled, microphoneEnabled, connectionQuality }),
  updateRoom: (roomId: string, settings: Partial<MafiaRoomSettings>) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "update_room", roomId, settings }),
  lockRoom: (roomId: string, locked: boolean) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "set_join_locked", roomId, locked }),
  transferHost: (roomId: string, targetUserId: string) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "transfer_host", roomId, targetUserId }),
  kickPlayer: (roomId: string, targetUserId: string) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "kick_player", roomId, targetUserId }),
  hostMute: (roomId: string, targetUserId: string, muted: boolean) =>
    invokeMafiaCommand<MafiaSnapshot>({ type: "set_host_mute", roomId, targetUserId, muted }),
  cancelRoom: (roomId: string) => invokeMafiaCommand<{ cancelled: true }>({ type: "cancel_room", roomId }),
  leave: (roomId: string) => invokeMafiaCommand<{ left: true }>({ type: "leave_room", roomId }),
};
