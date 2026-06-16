import type { Room as BaseRoom } from "../supabase/database.types";

export type PlatformRoom = BaseRoom & {
  title?: string | null;
  current_game?: string | null;
};

