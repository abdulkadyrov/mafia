import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.111.0";
import type { ChatChannel } from "../../../../src/core/chat/chatTypes.ts";
import type { GamePhase, NightActionType } from "../../../../src/core/game/gameTypes.ts";
import type { MafiaRole, RoleCounts } from "../../../../src/core/roles/roleTypes.ts";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type CommandContext = {
  user: User;
  admin: SupabaseClient;
};

export type RoomSettingsInput = {
  name?: string;
  maxPlayers?: number;
  isPrivate?: boolean;
  videoEnabled?: boolean;
  cameraRequired?: boolean;
  autoPhase?: boolean;
  chatEnabled?: boolean;
  deadChatEnabled?: boolean;
  deadCanObserve?: boolean;
  deadCanReadAliveChat?: boolean;
  nightSeconds?: number;
  discussionSeconds?: number;
  votingSeconds?: number;
  roles?: RoleCounts;
  roleAssignmentMode?: "random" | "manual";
  allowVoteChange?: boolean;
  tieRule?: "no_execution" | "revote";
};

export type MafiaCommand =
  | { commandId: string; type: "snapshot"; roomId: string }
  | { commandId: string; type: "my_rooms" }
  | { commandId: string; type: "create_room"; settings: RoomSettingsInput }
  | { commandId: string; type: "join_room"; code: string }
  | { commandId: string; type: "leave_room"; roomId: string }
  | { commandId: string; type: "set_ready"; roomId: string; ready: boolean }
  | {
      commandId: string;
      type: "set_media_status";
      roomId: string;
      cameraEnabled: boolean;
      microphoneEnabled: boolean;
      connectionQuality?: "unknown" | "excellent" | "good" | "poor" | "offline";
    }
  | { commandId: string; type: "update_room"; roomId: string; settings: RoomSettingsInput }
  | { commandId: string; type: "set_join_locked"; roomId: string; locked: boolean }
  | { commandId: string; type: "transfer_host"; roomId: string; targetUserId: string }
  | { commandId: string; type: "kick_player"; roomId: string; targetUserId: string }
  | { commandId: string; type: "set_host_mute"; roomId: string; targetUserId: string; muted: boolean }
  | { commandId: string; type: "add_bots"; roomId: string; count: number }
  | { commandId: string; type: "remove_bot"; roomId: string; roomPlayerId: string }
  | {
      commandId: string;
      type: "configure_roles";
      roomId: string;
      mode: "random" | "manual";
      assignments: Record<string, MafiaRole>;
    }
  | { commandId: string; type: "cancel_room"; roomId: string }
  | { commandId: string; type: "start_game"; roomId: string }
  | { commandId: string; type: "acknowledge_role"; roomId: string }
  | {
      commandId: string;
      type: "night_action";
      roomId: string;
      actionType: NightActionType;
      targetGamePlayerId: string;
    }
  | { commandId: string; type: "vote"; roomId: string; targetGamePlayerId: string }
  | { commandId: string; type: "advance_phase"; roomId: string; expectedVersion: number }
  | { commandId: string; type: "rematch"; roomId: string }
  | {
      commandId: string;
      type: "send_chat";
      roomId: string;
      channel: ChatChannel;
      content: string;
      clientNonce: string;
    };

export type RoomRow = {
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
  settings: Record<string, Json>;
  phase_started_at: string | null;
  phase_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomPlayerRow = {
  id: string;
  room_id: string;
  user_id: string | null;
  display_name: string;
  avatar_url: string | null;
  is_host: boolean;
  is_ready: boolean;
  life_status: "alive" | "dead" | "disconnected";
  camera_enabled: boolean;
  microphone_enabled: boolean;
  microphone_blocked: boolean;
  connection_quality: "unknown" | "excellent" | "good" | "poor" | "offline";
  last_seen_at: string;
  joined_at: string;
  is_bot: boolean;
  bot_difficulty: "medium" | null;
};

export type GameRow = {
  id: string;
  room_id: string;
  number: number;
  status: "active" | "finished" | "cancelled";
  phase: Exclude<GamePhase, "lobby">;
  phase_version: number;
  round_number: number;
  winning_team: "mafia" | "city" | "maniac" | "draw" | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type GamePlayerRow = {
  id: string;
  game_id: string;
  room_player_id: string;
  user_id: string | null;
  role: MafiaRole;
  team: "mafia" | "city" | "neutral" | "host";
  life_status: "alive" | "dead" | "disconnected";
  is_host: boolean;
  role_acknowledged_at: string | null;
  killed_at_phase: string | null;
  killed_at_round: number | null;
  death_reason: string | null;
  score: number;
  created_at: string;
  is_bot: boolean;
  bot_difficulty: "medium" | null;
};

export type GameActionRow = {
  id: string;
  game_id: string;
  round_number: number;
  phase: string;
  actor_game_player_id: string;
  target_game_player_id: string | null;
  action_type: NightActionType;
  result: Record<string, Json> | null;
  created_at: string;
};

export type EventRow = {
  id: number;
  room_id: string;
  game_id: string | null;
  round_number: number;
  phase: string;
  event_type: string;
  visibility: "public" | "host" | "private" | "mafia" | "dead";
  target_user_id: string | null;
  payload: Record<string, Json>;
  created_at: string;
};
