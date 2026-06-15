export type PlayerRole =
  | "unassigned"
  | "mafia"
  | "doctor"
  | "inspector"
  | "civilian";

export type GamePhase =
  | "lobby"
  | "night"
  | "day"
  | "voting"
  | "voting_confirmation"
  | "game_over";

export type RoomSettings = {
  playerLimit: number;
  roles: {
    mafia: number;
    doctors: number;
    detectives: number;
    civilians: number;
  };
  timers: {
    nightSeconds: number;
    discussionSeconds: number;
    votingSeconds: number;
  };
  mafiaDecisionMode: "unanimity" | "majority";
  roleAssignmentMode: "random" | "manual";
  revealRolesAfterDeath: boolean;
  showActionHistory: boolean;
  bettingMode: boolean;
  privateRoom: boolean;
  autoStart: boolean;
  doctorSelfHealsLimit: number;
};

export type Room = {
  id: string;
  code: string;
  host_player_id: string | null;
  status: string;
  phase: GamePhase;
  round_number: number;
  settings: RoomSettings;
  created_at: string;
  updated_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  name: string;
  role: PlayerRole;
  is_alive: boolean;
  is_host: boolean;
  score: number;
  joined_at: string;
};

export type GameEvent = {
  id: string;
  room_id: string;
  round_number: number;
  phase: string;
  type: string;
  message: string;
  visibility: string;
  target_player_id: string | null;
  created_at: string;
};

export type NightAction = {
  id: string;
  room_id: string;
  round_number: number;
  actor_player_id: string;
  target_player_id: string | null;
  action_type: string;
  created_at: string;
};

export type Vote = {
  id: string;
  room_id: string;
  round_number: number;
  voter_player_id: string;
  target_player_id: string | null;
  vote_type: string;
  created_at: string;
};
