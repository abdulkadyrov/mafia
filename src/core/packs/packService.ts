import { getSupabaseClient } from "../supabase/client";
import type { SupportedPackGame } from "./packTypes";

export async function saveGamePack(input: {
  roomId: string;
  gameType: SupportedPackGame;
  title: string;
  content: unknown;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("game_packs").insert({
    room_id: input.roomId,
    game_type: input.gameType,
    title: input.title,
    content: input.content,
  });

  if (error) {
    throw new Error("Не удалось сохранить пакет");
  }
}

