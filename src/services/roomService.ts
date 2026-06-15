import { getSupabaseClient } from "./supabaseClient";
import type { GamePhase, Player, Room, RoomSettings } from "../types/database";

const MAX_CODE_ATTEMPTS = 20;

export function generateRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createRoom(
  hostName: string,
  settings: RoomSettings
): Promise<{ room: Room; host: Player }> {
  const cleanHostName = hostName.trim();
  const supabase = getSupabaseClient();

  if (!cleanHostName) {
    throw new Error("Введите имя");
  }

  const code = await generateUniqueRoomCode();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      code,
      settings,
    })
    .select()
    .single();

  if (roomError || !room) {
    throw new Error("Ошибка создания комнаты");
  }

  const { data: host, error: hostError } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
      name: cleanHostName,
      is_host: true,
    })
    .select()
    .single();

  if (hostError || !host) {
    throw new Error("Ошибка создания комнаты");
  }

  const { error: updateRoomError } = await supabase
    .from("rooms")
    .update({
      host_player_id: host.id,
    })
    .eq("id", room.id);

  if (updateRoomError) {
    throw new Error("Ошибка создания комнаты");
  }

  return {
    room: {
      ...room,
      host_player_id: host.id,
    } satisfies Room,
    host: host satisfies Player,
  };
}

export async function joinRoom(
  code: string,
  playerName: string
): Promise<{ room: Room; player: Player }> {
  const normalizedCode = normalizeRoomCode(code);
  const cleanPlayerName = playerName.trim();
  const supabase = getSupabaseClient();

  if (!cleanPlayerName) {
    throw new Error("Введите имя");
  }

  if (!normalizedCode) {
    throw new Error("Введите код комнаты");
  }

  const room = await getRoomByCode(normalizedCode);

  if (!room) {
    throw new Error("Комната не найдена");
  }

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
      name: cleanPlayerName,
      is_host: false,
    })
    .select()
    .single();

  if (error || !player) {
    throw new Error("Ошибка входа в комнату");
  }

  return {
    room,
    player: player satisfies Player,
  };
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const normalizedCode = normalizeRoomCode(code);
  const supabase = getSupabaseClient();

  if (!normalizedCode) {
    return null;
  }

  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", normalizedCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error("Не удалось подключиться к Supabase");
  }

  return data satisfies Room;
}

export async function updateRoomPhase(
  roomId: string,
  phase: GamePhase,
  options?: {
    roundNumber?: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const status =
    phase === "lobby" ? "lobby" : phase === "game_over" ? "finished" : "active";
  const { error } = await supabase
    .from("rooms")
    .update({
      phase,
      status,
      ...(typeof options?.roundNumber === "number"
        ? { round_number: options.roundNumber }
        : {}),
    })
    .eq("id", roomId);

  if (error) {
    throw new Error("Не удалось обновить фазу комнаты");
  }
}

export async function updateRoomSettings(
  roomId: string,
  settings: RoomSettings
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("rooms")
    .update({
      settings,
    })
    .eq("id", roomId);

  if (error) {
    throw new Error("Не удалось обновить настройки комнаты");
  }
}

export function normalizeRoomCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

async function generateUniqueRoomCode(): Promise<string> {
  const supabase = getSupabaseClient();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const candidate = generateRoomCode();
    const { data, error } = await supabase
      .from("rooms")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();

    if (error) {
      throw new Error("Не удалось подключиться к Supabase");
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Не удалось сгенерировать код комнаты");
}
