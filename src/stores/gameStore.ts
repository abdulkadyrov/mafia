import React from "react";
import { createInitialSnapshot } from "../game/engine";
import { GameSnapshot } from "../types/game";

type GameStore = {
  snapshot: GameSnapshot;
  setSnapshot: React.Dispatch<React.SetStateAction<GameSnapshot>>;
};

const GameStateContext = React.createContext<GameStore | null>(null);

export const GameStateProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = React.useState<GameSnapshot>(() =>
    createInitialSnapshot({ roomCode: "LOCAL-00" })
  );

  return React.createElement(
    GameStateContext.Provider,
    {
      value: {
        snapshot,
        setSnapshot,
      },
    },
    children
  );
};

export function useGameState() {
  const context = React.useContext(GameStateContext);

  if (!context) {
    throw new Error("useGameState must be used inside GameStateProvider");
  }

  return context;
}
