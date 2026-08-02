import type { MafiaRole, MafiaTeam } from "../roles/roleTypes";

export type GamePhase =
  | "lobby"
  | "role_reveal"
  | "night_intro"
  | "night_mafia"
  | "night_doctor"
  | "night_commissioner"
  | "night_resolution"
  | "day_announcement"
  | "day_discussion"
  | "day_voting"
  | "day_execution"
  | "game_over";

export type PlayerLifeStatus = "alive" | "dead" | "disconnected";

export type DomainGamePlayer = {
  id: string;
  userId: string;
  role: MafiaRole;
  team: MafiaTeam;
  lifeStatus: PlayerLifeStatus;
  isHost: boolean;
};

export type NightActionType =
  | "mafia_kill"
  | "doctor_heal"
  | "commissioner_check"
  | "commissioner_kill"
  | "maniac_kill"
  | "mistress_block"
  | "bodyguard_protect";

export type DomainNightAction = {
  actorId: string;
  targetId: string;
  type: NightActionType;
};

export type GameWinner = "mafia" | "city" | "maniac" | "draw";
