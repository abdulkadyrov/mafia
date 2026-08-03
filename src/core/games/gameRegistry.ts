import React from "react";
import type { GameModule } from "./gameTypes";

const MafiaGameWrapper = React.lazy(() => import("../../games/mafia/MafiaGameWrapper").then((module) => ({ default: module.MafiaGameWrapper })));

export const gameRegistry: GameModule[] = [
  {
    id: "mafia",
    title: "Мафия",
    description: "Классическая игра с ролями, чатом и событиями",
    icon: "🎭",
    supportsTeams: false,
    supportsJsonPacks: false,
    component: MafiaGameWrapper,
  },
];
