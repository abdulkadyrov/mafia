import { getSupabaseClient } from "../supabase/client";

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

