import { getGameEvents } from "../../services/gameService";
import {
  createRoom as createBaseRoom,
  getRoomByCode,
  joinRoom as joinBaseRoom,
  normalizeRoomCode,
} from "../../services/roomService";
import { getSupabaseClient } from "../supabase/client";
import type { GameEvent, RoomSettings } from "../supabase/database.types";
import type { PlatformRoom } from "./roomTypes";

export { normalizeRoomCode };

export async function createPlatformRoom(
  hostName: string,
  settings: RoomSettings
) {
  const result = await createBaseRoom(hostName, settings);

  await updateRoomMeta(result.room.id, {
    title: "Abdulkadyrov Games Room",
    current_game: null,
  });

  return result;
}

export async function joinPlatformRoom(code: string, playerName: string) {
  return joinBaseRoom(code, playerName);
}

export async function getPlatformRoomByCode(
  code: string
): Promise<PlatformRoom | null> {
  const room = await getRoomByCode(code);
  return room as PlatformRoom | null;
}

export async function updateRoomMeta(
  roomId: string,
  patch: Partial<Pick<PlatformRoom, "title" | "current_game" | "status">>
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("rooms").update(patch).eq("id", roomId);

  if (error) {
    throw new Error("Не удалось обновить параметры комнаты");
  }
}

export async function getRoomChatMessages(roomId: string): Promise<GameEvent[]> {
  const events = await getGameEvents(roomId);
  return events.filter((event) => event.type === "chat_message");
}

