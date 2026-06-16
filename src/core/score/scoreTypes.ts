export type ScoreEvent = {
  id: string;
  room_id: string;
  team_id: string;
  delta: number;
  reason: string | null;
  created_at: string;
};

