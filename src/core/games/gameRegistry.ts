import { AliasGame } from "../../games/alias/AliasGame";
import { MafiaGameWrapper } from "../../games/mafia/MafiaGameWrapper";
import { MillionaireGame } from "../../games/millionaire/MillionaireGame";
import type { GameModule } from "./gameTypes";

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

