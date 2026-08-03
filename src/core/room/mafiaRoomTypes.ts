import type { ChatChannel } from "../chat/chatTypes";
import type { GamePhase, GameWinner, PlayerLifeStatus } from "../game/gameTypes";
import type { MafiaRole, MafiaTeam, RoleCounts } from "../roles/roleTypes";

export type MafiaRoomSettings = {
  name: string;
  maxPlayers: number;
  isPrivate: boolean;
  videoEnabled: boolean;
  cameraRequired: boolean;
  autoPhase: boolean;
  chatEnabled: boolean;
  deadChatEnabled: boolean;
  deadCanObserve: boolean;
  deadCanReadAliveChat: boolean;
  nightSeconds: number;
  discussionSeconds: number;
  votingSeconds: number;
  roles: RoleCounts;
  roleAssignmentMode: "random" | "manual";
  allowVoteChange: boolean;
  tieRule: "no_execution" | "revote";
};

export type MafiaRoomRecord = {
  id: string;
  code: string;
  name: string;
  created_by: string;
  host_user_id: string;
  status: "lobby" | "active" | "finished" | "cancelled";
  phase: GamePhase;
  phase_version: number;
  round_number: number;
  max_players: number;
  is_private: boolean;
  join_locked: boolean;
  video_enabled: boolean;
  camera_required: boolean;
  auto_phase: boolean;
  chat_enabled: boolean;
  dead_chat_enabled: boolean;
  dead_can_observe: boolean;
  dead_can_read_alive_chat: boolean;
  settings: {
    nightSeconds: number;
    discussionSeconds: number;
    votingSeconds: number;
    roles: RoleCounts;
    roleAssignmentMode: "random" | "manual";
    manualRoles?: Record<string, MafiaRole>;
    allowVoteChange: boolean;
    tieRule: "no_execution" | "revote";
    doctorSelfHealsLimit?: number;
  };
  phase_started_at: string | null;
  phase_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MafiaGameRecord = {
  id: string;
  room_id: string;
  number: number;
  status: "active" | "finished" | "cancelled";
  phase: Exclude<GamePhase, "lobby">;
  phase_version: number;
  round_number: number;
  winning_team: GameWinner | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type MafiaPlayerView = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_host: boolean;
  is_ready: boolean;
  life_status: PlayerLifeStatus;
  camera_enabled: boolean;
  microphone_enabled: boolean;
  microphone_blocked: boolean;
  connection_quality: "unknown" | "excellent" | "good" | "poor" | "offline";
  last_seen_at: string;
  joined_at: string;
  gamePlayerId: string | null;
  role: MafiaRole | null;
  team: MafiaTeam | null;
  deathReason: string | null;
  score?: number;
  is_bot: boolean;
  bot_difficulty: "medium" | null;
};

export type MafiaEvent = {
  id: number | string;
  room_id: string;
  game_id: string | null;
  round_number: number;
  phase: string;
  event_type: string;
  visibility: "public" | "host" | "private" | "mafia" | "dead";
  target_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type MafiaChatMessage = {
  id: string;
  room_id: string;
  game_id: string | null;
  author_user_id: string | null;
  author_name: string;
  channel: ChatChannel;
  content: string;
  client_nonce: string | null;
  created_at: string;
};

export type MafiaSelf = {
  roomPlayerId: string;
  gamePlayerId: string | null;
  role: MafiaRole | null;
  team: MafiaTeam | null;
  lifeStatus: PlayerLifeStatus;
  isHost: boolean;
  roleAcknowledgedAt: string | null;
};

export type MafiaSnapshot = {
  room: MafiaRoomRecord;
  game: MafiaGameRecord | null;
  players: MafiaPlayerView[];
  self: MafiaSelf;
  events: MafiaEvent[];
  messages: MafiaChatMessage[];
  voteCounts?: Record<string, number>;
  serverTime: string;
};
