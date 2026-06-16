import React from "react";
import type { Player } from "../supabase/database.types";
import { getSessionSnapshot } from "../../utils/storage";
import { useRoom } from "../room/useRoom";

type PlayerContextValue = {
  currentPlayer: Player | null;
  playerId: string | null;
  playerName: string | null;
};

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { players } = useRoom();
  const session = getSessionSnapshot();
  const currentPlayer =
    players.find((player) => player.id === session.playerId) ?? null;

  return (
    <PlayerContext.Provider
      value={{
        currentPlayer,
        playerId: session.playerId,
        playerName: session.playerName,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext() {
  const context = React.useContext(PlayerContext);

  if (!context) {
    throw new Error("usePlayerContext must be used within PlayerProvider");
  }

  return context;
}

