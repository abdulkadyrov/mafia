import { getSupabaseClient } from "./supabaseClient";
import type { GameEvent, NightAction, Vote } from "../types/database";

export async function addGameEvent(
  roomId: string,
  event: Omit<GameEvent, "id" | "room_id" | "created_at">
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("game_events").insert({
    room_id: roomId,
    ...event,
  });

  if (error) {
    throw new Error("Не удалось сохранить игровое событие");
  }
}

export async function addNightAction(
  roomId: string,
  action: Omit<NightAction, "id" | "room_id" | "created_at">
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("night_actions").upsert(
    {
      room_id: roomId,
      ...action,
    },
    {
      onConflict: "room_id,round_number,actor_player_id,action_type",
    }
  );

  if (error) {
    throw new Error("Не удалось сохранить ночное действие");
  }
}

export async function addVote(
  roomId: string,
  vote: Omit<Vote, "id" | "room_id" | "created_at">
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("votes").upsert(
    {
      room_id: roomId,
      ...vote,
    },
    {
      onConflict: "room_id,round_number,voter_player_id,vote_type",
    }
  );

  if (error) {
    throw new Error("Не удалось сохранить голос");
  }
}

export async function getNightActions(
  roomId: string,
  roundNumber: number
): Promise<NightAction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("night_actions")
    .select("*")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Не удалось получить ночные действия");
  }

  return data satisfies NightAction[];
}

export async function getVotes(
  roomId: string,
  roundNumber: number,
  voteType: string
): Promise<Vote[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("votes")
    .select("*")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber)
    .eq("vote_type", voteType)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Не удалось получить голоса");
  }

  return data satisfies Vote[];
}

export async function getDoctorSelfHealCount(
  roomId: string,
  playerId: string
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("night_actions")
    .select("id")
    .eq("room_id", roomId)
    .eq("actor_player_id", playerId)
    .eq("target_player_id", playerId)
    .eq("action_type", "doctorHeal");

  if (error) {
    throw new Error("Не удалось получить историю лечения");
  }

  return data.length;
}
