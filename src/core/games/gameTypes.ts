import React from "react";

export type GameModuleProps = {
  roomCode: string;
};

export type GameModule = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  minPlayers?: number;
  supportsTeams: boolean;
  supportsJsonPacks: boolean;
  component: React.ComponentType<GameModuleProps>;
};

