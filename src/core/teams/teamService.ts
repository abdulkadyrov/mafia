import { getSupabaseClient } from "../supabase/client";
import type { Team } from "./teamTypes";

export async function getTeams(roomId: string): Promise<Team[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Не удалось получить команды");
  }

  return data as Team[];
}

export async function createTeam(input: {
  roomId: string;
  name: string;
  color?: string | null;
}): Promise<Team> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({
      room_id: input.roomId,
      name: input.name.trim(),
      color: input.color ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Не удалось создать команду");
  }

  return data as Team;
}

export async function updateTeamScore(teamId: string, score: number) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("teams").update({ score }).eq("id", teamId);

  if (error) {
    throw new Error("Не удалось обновить счёт команды");
  }
}

