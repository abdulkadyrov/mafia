import { getSupabaseClient } from "../supabase/client";

export type GamePackRecord = {
  id: string;
  room_id: string;
  game_type: string;
  title: string;
  content: unknown;
  created_at: string;
};

export type GameStateRecord = {
  room_id: string;
  game_type: string;
  state: unknown;
  updated_at: string;
};

export async function getGamePacksByType(
  roomId: string,
  gameType: string
): Promise<GamePackRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("game_packs")
    .select("*")
    .eq("room_id", roomId)
    .eq("game_type", gameType)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Не удалось получить игровые пакеты");
  }

  return data as GamePackRecord[];
}

export async function getGameState<T>(
  roomId: string,
  gameType: string
): Promise<T | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("game_state")
    .select("*")
    .eq("room_id", roomId)
    .eq("game_type", gameType)
    .maybeSingle();

  if (error) {
    throw new Error("Не удалось получить состояние игры");
  }

  return (data?.state as T | undefined) ?? null;
}

export async function saveGameState<T>(
  roomId: string,
  gameType: string,
  state: T
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("game_state").upsert(
    {
      room_id: roomId,
      game_type: gameType,
      state,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "room_id",
    }
  );

  if (error) {
    throw new Error("Не удалось сохранить состояние игры");
  }
}

