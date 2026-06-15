import { RoomSettings } from "../types/game";

export const defaultRoomSettings: RoomSettings = {
  playerLimit: 8,
  roles: {
    mafia: 2,
    doctors: 1,
    detectives: 1,
    civilians: 4,
  },
  timers: {
    nightSeconds: 45,
    discussionSeconds: 120,
    votingSeconds: 45,
  },
  mafiaDecisionMode: "majority",
  roleAssignmentMode: "random",
  revealRolesAfterDeath: true,
  showActionHistory: true,
  bettingMode: false,
  privateRoom: false,
  autoStart: false,
  doctorSelfHealsLimit: 1,
};

export const samplePlayerNames = [
  "Тимур",
  "Леха",
  "Адам",
  "Мира",
  "Ника",
  "Саша",
  "Илья",
  "Рита",
];
