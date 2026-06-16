import { getSupabaseClient } from "../supabase/client";
import { getTeams, updateTeamScore } from "../teams/teamService";

export async function addScoreEvent(input: {
  roomId: string;
  teamId: string;
  delta: number;
  reason?: string;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("score_events").insert({
    room_id: input.roomId,
    team_id: input.teamId,
    delta: input.delta,
    reason: input.reason ?? null,
  });

  if (error) {
    throw new Error("Не удалось сохранить изменение счёта");
  }
}

export async function applyScoreDelta(input: {
  roomId: string;
  teamId: string;
  delta: number;
  reason?: string;
}) {
  const teams = await getTeams(input.roomId);
  const team = teams.find((item) => item.id === input.teamId);

  if (!team) {
    throw new Error("Команда не найдена");
  }

  await updateTeamScore(team.id, team.score + input.delta);
  await addScoreEvent(input);
}
