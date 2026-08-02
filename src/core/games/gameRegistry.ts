import React from "react";
import type { GameModule } from "./gameTypes";

const AliasGame = React.lazy(() => import("../../games/alias/AliasGame").then((module) => ({ default: module.AliasGame })));
const MafiaGameWrapper = React.lazy(() => import("../../games/mafia/MafiaGameWrapper").then((module) => ({ default: module.MafiaGameWrapper })));
const MillionaireGame = React.lazy(() => import("../../games/millionaire/MillionaireGame").then((module) => ({ default: module.MillionaireGame })));

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
  {
    id: "millionaire",
    title: "Кто хочет стать миллионером",
    description: "Командная викторина с вопросами, вариантами и картинками",
    icon: "💡",
    supportsTeams: true,
    supportsJsonPacks: true,
    component: MillionaireGame,
  },
  {
    id: "alias",
    title: "Alias",
    description: "Командная игра на объяснение слов",
    icon: "🗣️",
    supportsTeams: true,
    supportsJsonPacks: true,
    component: AliasGame,
  },
];
