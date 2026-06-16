import React from "react";
import { useRoom } from "../room/useRoom";
import { subscribeToGamePacks, unsubscribe } from "../supabase/realtime";
import { getGamePacksByType } from "../games/gameStateService";
import type { SupportedPackGame } from "./packTypes";

export function useGamePacks(gameType: SupportedPackGame) {
  const { room } = useRoom();
  const [packs, setPacks] = React.useState<
    Awaited<ReturnType<typeof getGamePacksByType>>
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!room?.id) {
      setPacks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const nextPacks = await getGamePacksByType(room.id, gameType);
    setPacks(nextPacks);
    setIsLoading(false);
  }, [gameType, room?.id]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!room?.id) {
      return undefined;
    }

    const channel = subscribeToGamePacks(room.id, () => {
      void refresh();
    });

    return () => {
      unsubscribe(channel);
    };
  }, [refresh, room?.id]);

  return { packs, isLoading, refresh };
}
