import type { SupabaseClient } from "npm:@supabase/supabase-js@2.111.0";
import type { GamePhase } from "../../../../src/core/game/gameTypes.ts";
import type { MafiaRole, RoleCounts } from "../../../../src/core/roles/roleTypes.ts";
import type { CommandContext, EventRow, GamePlayerRow, GameRow, Json, RoomPlayerRow, RoomRow, RoomSettingsInput } from "./types.ts";

export class CommandError extends Error {
  constructor(message: string, public status = 400, public code = "invalid_command") {
    super(message);
  }
}

export function assertUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CommandError(`Некорректное поле ${field}`);
  }
}

export function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

export function cleanName(value: unknown, fallback = "Вечерняя мафия"): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 48) throw new CommandError("Название должно содержать от 2 до 48 символов");
  return clean;
}

export function normalizeCode(value: unknown): string {
  if (typeof value !== "string") throw new CommandError("Введите код комнаты");
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length !== 6) throw new CommandError("Код комнаты должен содержать 6 символов");
  return code;
}

export function normalizeSettings(input: RoomSettingsInput, current?: RoomRow): Partial<RoomRow> {
  const prior = current?.settings ?? {};
  const roleInput = input.roles ?? (prior.roles as RoleCounts | undefined) ?? {};
  const roles: RoleCounts = {
    mafia: clampInteger(roleInput.mafia, 2, 1, 6),
    don: clampInteger(roleInput.don, 0, 0, 1),
    doctor: clampInteger(roleInput.doctor, 1, 0, 2),
    commissioner: clampInteger(roleInput.commissioner, 1, 0, 2),
    maniac: clampInteger(roleInput.maniac, 0, 0, 1),
    mistress: clampInteger(roleInput.mistress, 0, 0, 1),
    bodyguard: clampInteger(roleInput.bodyguard, 0, 0, 1),
    civilian: clampInteger(roleInput.civilian, 2, 0, 12),
  };

  return {
    ...(input.name === undefined ? {} : { name: cleanName(input.name) }),
    max_players: clampInteger(input.maxPlayers, current?.max_players ?? 10, 6, 16),
    is_private: input.isPrivate ?? current?.is_private ?? true,
    video_enabled: input.videoEnabled ?? current?.video_enabled ?? true,
    camera_required: input.cameraRequired ?? current?.camera_required ?? false,
    auto_phase: input.autoPhase ?? current?.auto_phase ?? false,
    chat_enabled: input.chatEnabled ?? current?.chat_enabled ?? true,
    dead_chat_enabled: input.deadChatEnabled ?? current?.dead_chat_enabled ?? true,
    dead_can_observe: input.deadCanObserve ?? current?.dead_can_observe ?? true,
    dead_can_read_alive_chat: input.deadCanReadAliveChat ?? current?.dead_can_read_alive_chat ?? false,
    settings: {
      ...prior,
      nightSeconds: clampInteger(input.nightSeconds, Number(prior.nightSeconds ?? 45), 15, 300),
      discussionSeconds: clampInteger(input.discussionSeconds, Number(prior.discussionSeconds ?? 180), 30, 900),
      votingSeconds: clampInteger(input.votingSeconds, Number(prior.votingSeconds ?? 45), 15, 180),
      roles: roles as unknown as Json,
      roleAssignmentMode: input.roleAssignmentMode ?? prior.roleAssignmentMode ?? "random",
      allowVoteChange: input.allowVoteChange ?? prior.allowVoteChange ?? false,
      tieRule: input.tieRule ?? prior.tieRule ?? "no_execution",
    },
  } as Partial<RoomRow>;
}

export async function requireRoom(admin: SupabaseClient, roomId: string): Promise<RoomRow> {
  assertUuid(roomId, "roomId");
  const { data, error } = await admin.from("mafia_rooms").select("*").eq("id", roomId).single();
  if (error || !data) throw new CommandError("Комната не найдена", 404, "room_not_found");
  return data as RoomRow;
}

export async function requireMembership(context: CommandContext, roomId: string): Promise<RoomPlayerRow> {
  const { data, error } = await context.admin
    .from("mafia_room_players")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", context.user.id)
    .single();
  if (error || !data) throw new CommandError("Вы не состоите в этой комнате", 403, "not_room_member");
  return data as RoomPlayerRow;
}

export async function requireHost(context: CommandContext, roomId: string): Promise<RoomRow> {
  const room = await requireRoom(context.admin, roomId);
  if (room.host_user_id !== context.user.id) throw new CommandError("Действие доступно только ведущему", 403, "host_required");
  return room;
}

export async function getCurrentGame(admin: SupabaseClient, roomId: string): Promise<GameRow | null> {
  const { data, error } = await admin
    .from("mafia_games")
    .select("*")
    .eq("room_id", roomId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new CommandError("Не удалось загрузить партию", 500, "game_load_failed");
  return data as GameRow | null;
}

export async function requireActiveGame(admin: SupabaseClient, roomId: string): Promise<GameRow> {
  const game = await getCurrentGame(admin, roomId);
  if (!game || game.status !== "active") throw new CommandError("Активная партия не найдена", 409, "game_not_active");
  return game;
}

export async function getGamePlayers(admin: SupabaseClient, gameId: string): Promise<GamePlayerRow[]> {
  const { data, error } = await admin.from("mafia_game_players").select("*").eq("game_id", gameId).order("created_at");
  if (error) throw new CommandError("Не удалось загрузить игроков", 500, "players_load_failed");
  return (data ?? []) as GamePlayerRow[];
}

export function phaseDurationSeconds(room: RoomRow, phase: GamePhase): number | null {
  if (phase.startsWith("night_")) return Number(room.settings.nightSeconds ?? 45);
  if (phase === "day_discussion") return Number(room.settings.discussionSeconds ?? 180);
  if (phase === "day_voting") return Number(room.settings.votingSeconds ?? 45);
  return null;
}

export function phaseTimes(room: RoomRow, phase: GamePhase) {
  const started = new Date();
  const duration = phaseDurationSeconds(room, phase);
  return {
    phase_started_at: started.toISOString(),
    phase_ends_at: duration ? new Date(started.getTime() + duration * 1000).toISOString() : null,
  };
}

export async function addEvent(
  admin: SupabaseClient,
  values: Omit<EventRow, "id" | "created_at">
): Promise<void> {
  const { error } = await admin.from("mafia_game_events").insert(values);
  if (error) throw new CommandError("Не удалось сохранить событие", 500, "event_write_failed");
}

export async function addSystemMessage(
  admin: SupabaseClient,
  room: RoomRow,
  game: GameRow | null,
  content: string
): Promise<void> {
  const { error } = await admin.from("mafia_chat_messages").insert({
    room_id: room.id,
    game_id: game?.id ?? null,
    author_user_id: null,
    author_name: "Ведущий",
    channel: "system_chat",
    content,
  });
  if (error) throw new CommandError("Не удалось сохранить системное сообщение", 500, "system_message_failed");
}

export function randomUnit(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}

export function getDefaultRoleCounts(playerCount: number, room: RoomRow): RoleCounts {
  const saved = (room.settings.roles ?? {}) as RoleCounts;
  const fixed = ["mafia", "don", "doctor", "commissioner", "maniac", "mistress", "bodyguard"] as MafiaRole[];
  const used = fixed.reduce((total, role) => total + Number(saved[role] ?? 0), 0);
  return { ...saved, civilian: Math.max(0, playerCount - used) };
}
