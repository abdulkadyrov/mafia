import React from "react";
import { useRoom } from "../room/useRoom";
import { subscribeToGameState, unsubscribe } from "../supabase/realtime";
import { getGameState, saveGameState } from "./gameStateService";

export function useGameState<T>(
  gameType: string,
  createInitialState: () => T
) {
  const { room } = useRoom();
  const [state, setState] = React.useState<T>(createInitialState);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!room?.id) {
      setState(createInitialState());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const nextState = await getGameState<T>(room.id, gameType);
    setState(nextState ?? createInitialState());
    setIsLoading(false);
  }, [createInitialState, gameType, room?.id]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!room?.id) {
      return undefined;
    }

    const channel = subscribeToGameState(room.id, () => {
      void refresh();
    });

    return () => {
      unsubscribe(channel);
    };
  }, [refresh, room?.id]);

  const updateState = React.useCallback(
    async (nextState: T) => {
      if (!room?.id) {
        return;
      }

      await saveGameState(room.id, gameType, nextState);
      setState(nextState);
    },
    [gameType, room?.id]
  );

  return {
    state,
    isLoading,
    refresh,
    updateState,
  };
}

