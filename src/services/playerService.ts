import { getSupabaseClient } from "./supabaseClient";
import type { Player, PlayerRole } from "../types/database";

export async function createPlayerInRoom(
  roomId: string,
  name: string,
  options?: {
    isHost?: boolean;
  }
): Promise<Player> {
  const supabase = getSupabaseClient();
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Не удалось создать бота");
  }

  const { data, error } = await supabase
    .from("players")
    .insert({
      room_id: roomId,
      name: cleanName,
      is_host: Boolean(options?.isHost),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Не удалось создать бота");
  }

  return data satisfies Player;
}

export async function getPlayers(roomId: string): Promise<Player[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error("Не удалось получить игроков");
  }

  return data satisfies Player[];
}

export async function updatePlayerRole(
  playerId: string,
  role: PlayerRole
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("players")
    .update({
      role,
    })
    .eq("id", playerId);

  if (error) {
    throw new Error("Не удалось обновить роль игрока");
  }
}

export async function killPlayer(playerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("players")
    .update({
      is_alive: false,
    })
    .eq("id", playerId);

  if (error) {
    throw new Error("Не удалось обновить статус игрока");
  }
}

export async function revivePlayer(playerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("players")
    .update({
      is_alive: true,
    })
    .eq("id", playerId);

  if (error) {
    throw new Error("Не удалось обновить статус игрока");
  }
}

export async function updatePlayerScore(
  playerId: string,
  score: number
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("players")
    .update({
      score,
    })
    .eq("id", playerId);

  if (error) {
    throw new Error("Не удалось обновить счёт игрока");
  }
}

export async function resetPlayersForNewGame(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("players")
    .update({
      is_alive: true,
      role: "unassigned",
      score: 0,
    })
    .eq("room_id", roomId);

  if (error) {
    throw new Error("Не удалось подготовить игроков к новой игре");
  }
}
