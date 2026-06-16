import { getSupabaseClient } from "../supabase/client";
import type { Team } from "./teamTypes";

export type TeamMember = {
  team_id: string;
  player_id: string;
  created_at: string;
};

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

export async function getTeamMembers(roomId: string): Promise<TeamMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, player_id, created_at, players!inner(room_id)")
    .eq("players.room_id", roomId);

  if (error) {
    throw new Error("Не удалось получить состав команд");
  }

  return (data as Array<TeamMember & { players: { room_id: string } }>).map(
    ({ team_id, player_id, created_at }) => ({
      team_id,
      player_id,
      created_at,
    })
  );
}

export async function assignPlayerToTeam(input: {
  teamId: string;
  playerId: string;
}) {
  const supabase = getSupabaseClient();
  const { error: removeError } = await supabase
    .from("team_members")
    .delete()
    .eq("player_id", input.playerId);

  if (removeError) {
    throw new Error("Не удалось обновить состав команды");
  }

  const { error } = await supabase.from("team_members").insert({
    team_id: input.teamId,
    player_id: input.playerId,
  });

  if (error) {
    throw new Error("Не удалось добавить игрока в команду");
  }
}

export async function removePlayerFromTeam(playerId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("player_id", playerId);

  if (error) {
    throw new Error("Не удалось убрать игрока из команды");
  }
}
