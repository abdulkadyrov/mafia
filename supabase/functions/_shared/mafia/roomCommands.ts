import type { MafiaRole } from "../../../../src/core/roles/roleTypes.ts";
import type { CommandContext, RoomPlayerRow, RoomSettingsInput } from "./types.ts";
import {
  addEvent,
  addSystemMessage,
  assertUuid,
  CommandError,
  cleanName,
  getCurrentGame,
  normalizeCode,
  normalizeSettings,
  requireHost,
  requireMembership,
  requireRoom,
} from "./helpers.ts";
import { getSnapshot } from "./snapshot.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BOT_NAMES = [
  "Марко", "Сильва", "Вито", "Нора", "Роза", "Лео", "Марта", "Энцо",
  "Луна", "Тони", "Софи", "Дино", "Клара", "Рико", "Белла", "Нико",
];
const ASSIGNABLE_ROLES = new Set<MafiaRole>([
  "mafia", "don", "doctor", "commissioner", "civilian", "maniac", "mistress", "bodyguard",
]);

export async function createRoom(context: CommandContext, settingsInput: RoomSettingsInput) {
  const { data: profile, error: profileError } = await context.admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", context.user.id)
    .single();
  if (profileError || !profile) throw new CommandError("Сначала заполните профиль", 409, "profile_required");

  const normalized = normalizeSettings(settingsInput);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createCode();
    const { data: room, error } = await context.admin
      .from("mafia_rooms")
      .insert({
        code,
        name: cleanName(settingsInput.name),
        created_by: context.user.id,
        host_user_id: context.user.id,
        ...normalized,
      })
      .select("*")
      .single();
    if (error) {
      lastError = error;
      if (error.code === "23505") continue;
      throw new CommandError("Не удалось создать комнату", 500, "room_create_failed");
    }

    const { error: playerError } = await context.admin.from("mafia_room_players").insert({
      room_id: room.id,
      user_id: context.user.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      is_host: true,
      is_ready: true,
    });
    if (playerError) {
      await context.admin.from("mafia_rooms").delete().eq("id", room.id);
      throw new CommandError("Не удалось добавить ведущего", 500, "host_create_failed");
    }

    await addEvent(context.admin, {
      room_id: room.id,
      game_id: null,
      round_number: 0,
      phase: "lobby",
      event_type: "room_created",
      visibility: "public",
      target_user_id: null,
      payload: { userId: context.user.id, displayName: profile.display_name },
    });
    await addSystemMessage(context.admin, room, null, `${profile.display_name} создал комнату.`);
    return getSnapshot(context, room.id);
  }
  console.error("room code allocation failed", lastError instanceof Error ? lastError.message : "unknown");
  throw new CommandError("Не удалось подобрать код комнаты", 503, "room_code_exhausted");
}

export async function joinRoom(context: CommandContext, rawCode: string) {
  const code = normalizeCode(rawCode);
  const { data: room, error: roomError } = await context.admin.from("mafia_rooms").select("*").eq("code", code).maybeSingle();
  if (roomError || !room) throw new CommandError("Комната не найдена", 404, "room_not_found");

  const { data: existing } = await context.admin
    .from("mafia_room_players")
    .select("*")
    .eq("room_id", room.id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (existing) {
    await context.admin.from("mafia_room_players").update({
      life_status: room.status === "active" ? existing.life_status : "alive",
      connection_quality: "good",
      last_seen_at: new Date().toISOString(),
    }).eq("id", existing.id);
    return getSnapshot(context, room.id);
  }

  if (room.join_locked) throw new CommandError("Ведущий закрыл вход в комнату", 409, "room_locked");
  if (room.status !== "lobby") throw new CommandError("Партия уже началась", 409, "game_started");
  const { count } = await context.admin
    .from("mafia_room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) >= room.max_players) throw new CommandError("Комната заполнена", 409, "room_full");

  const { data: profile, error: profileError } = await context.admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", context.user.id)
    .single();
  if (profileError || !profile) throw new CommandError("Сначала заполните профиль", 409, "profile_required");
  const { error: insertError } = await context.admin.from("mafia_room_players").insert({
    room_id: room.id,
    user_id: context.user.id,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
  });
  if (insertError) throw new CommandError("Не удалось войти в комнату", 500, "room_join_failed");

  await addEvent(context.admin, {
    room_id: room.id,
    game_id: null,
    round_number: 0,
    phase: "lobby",
    event_type: "player_joined",
    visibility: "public",
    target_user_id: null,
    payload: { userId: context.user.id, displayName: profile.display_name },
  });
  await addSystemMessage(context.admin, room, null, `${profile.display_name} вошёл в комнату.`);
  return getSnapshot(context, room.id);
}

export async function leaveRoom(context: CommandContext, roomId: string) {
  const room = await requireRoom(context.admin, roomId);
  const member = await requireMembership(context, roomId);
  const { data: members } = await context.admin
    .from("mafia_room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at");
  const remaining = ((members ?? []) as RoomPlayerRow[]).filter((candidate) => candidate.id !== member.id);

  if (room.status === "active") {
    await context.admin.from("mafia_room_players").update({
      life_status: "disconnected",
      camera_enabled: false,
      microphone_enabled: false,
      connection_quality: "offline",
      last_seen_at: new Date().toISOString(),
    }).eq("id", member.id);
    const game = await context.admin.from("mafia_games").select("id").eq("room_id", roomId).eq("status", "active").maybeSingle();
    if (game.data) {
      await context.admin.from("mafia_game_players").update({ life_status: "disconnected" }).eq("game_id", game.data.id).eq("user_id", context.user.id);
    }
  } else {
    await context.admin.from("mafia_room_players").delete().eq("id", member.id);
  }

  const nextHumanHost = remaining.find((candidate) => !candidate.is_bot && candidate.user_id);
  if (room.host_user_id === context.user.id && nextHumanHost?.user_id) {
    await context.admin.from("mafia_rooms").update({ host_user_id: nextHumanHost.user_id }).eq("id", roomId);
    await context.admin.from("mafia_room_players").update({ is_host: true, is_ready: true }).eq("id", nextHumanHost.id);
  } else if (remaining.length === 0 || (room.host_user_id === context.user.id && !nextHumanHost)) {
    await context.admin.from("mafia_rooms").update({ status: "cancelled", join_locked: true }).eq("id", roomId);
  }
  await addSystemMessage(context.admin, room, null, `${member.display_name} покинул комнату.`);
  return { left: true };
}

export async function setReady(context: CommandContext, roomId: string, ready: boolean) {
  const room = await requireRoom(context.admin, roomId);
  const member = await requireMembership(context, roomId);
  if (room.status !== "lobby") throw new CommandError("Готовность меняется только в лобби", 409, "not_lobby");
  const { error } = await context.admin.from("mafia_room_players").update({ is_ready: Boolean(ready), last_seen_at: new Date().toISOString() }).eq("id", member.id);
  if (error) throw new CommandError("Не удалось изменить готовность", 500, "ready_update_failed");
  return getSnapshot(context, roomId);
}

export async function setMediaStatus(
  context: CommandContext,
  roomId: string,
  cameraEnabled: boolean,
  microphoneEnabled: boolean,
  connectionQuality = "unknown"
) {
  const member = await requireMembership(context, roomId);
  const allowedQuality = ["unknown", "excellent", "good", "poor", "offline"].includes(connectionQuality)
    ? connectionQuality
    : "unknown";
  const actualMicrophone = member.microphone_blocked || member.life_status === "dead" ? false : Boolean(microphoneEnabled);
  const { error } = await context.admin.from("mafia_room_players").update({
    camera_enabled: Boolean(cameraEnabled),
    microphone_enabled: actualMicrophone,
    connection_quality: allowedQuality,
    last_seen_at: new Date().toISOString(),
  }).eq("id", member.id);
  if (error) throw new CommandError("Не удалось обновить состояние устройств", 500, "media_update_failed");
  return { cameraEnabled: Boolean(cameraEnabled), microphoneEnabled: actualMicrophone, connectionQuality: allowedQuality };
}

export async function updateRoom(context: CommandContext, roomId: string, settings: RoomSettingsInput) {
  const room = await requireHost(context, roomId);
  if (room.status !== "lobby") throw new CommandError("Настройки меняются только в лобби", 409, "not_lobby");
  const normalized = normalizeSettings(settings, room);
  const { count } = await context.admin.from("mafia_room_players").select("id", { count: "exact", head: true }).eq("room_id", roomId);
  if (Number(normalized.max_players ?? room.max_players) < (count ?? 0)) {
    throw new CommandError("Лимит не может быть меньше числа игроков");
  }
  const { error } = await context.admin.from("mafia_rooms").update(normalized).eq("id", roomId);
  if (error) throw new CommandError("Не удалось сохранить настройки", 500, "room_update_failed");
  return getSnapshot(context, roomId);
}

export async function setJoinLocked(context: CommandContext, roomId: string, locked: boolean) {
  await requireHost(context, roomId);
  const { error } = await context.admin.from("mafia_rooms").update({ join_locked: Boolean(locked) }).eq("id", roomId);
  if (error) throw new CommandError("Не удалось изменить доступ в комнату", 500, "room_lock_failed");
  return getSnapshot(context, roomId);
}

export async function transferHost(context: CommandContext, roomId: string, targetUserId: string) {
  const room = await requireHost(context, roomId);
  const { data: target, error } = await context.admin
    .from("mafia_room_players")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .single();
  if (error || !target) throw new CommandError("Игрок не найден", 404, "player_not_found");
  await context.admin.from("mafia_room_players").update({ is_host: false }).eq("room_id", roomId);
  await context.admin.from("mafia_room_players").update({ is_host: true, is_ready: true }).eq("id", target.id);
  const { error: roomError } = await context.admin.from("mafia_rooms").update({ host_user_id: targetUserId }).eq("id", roomId).eq("host_user_id", room.host_user_id);
  if (roomError) throw new CommandError("Не удалось передать роль ведущего", 409, "host_transfer_failed");
  await addSystemMessage(context.admin, room, null, `${target.display_name} теперь ведущий.`);
  return getSnapshot(context, roomId);
}

export async function kickPlayer(context: CommandContext, roomId: string, targetUserId: string) {
  const room = await requireHost(context, roomId);
  if (targetUserId === context.user.id) throw new CommandError("Ведущий не может исключить себя");
  const { data: target } = await context.admin.from("mafia_room_players").select("*").eq("room_id", roomId).eq("user_id", targetUserId).maybeSingle();
  if (!target) throw new CommandError("Игрок не найден", 404, "player_not_found");
  if (room.status === "active") {
    await context.admin.from("mafia_room_players").update({ life_status: "disconnected", microphone_enabled: false, microphone_blocked: true }).eq("id", target.id);
    const { data: game } = await context.admin.from("mafia_games").select("id").eq("room_id", roomId).eq("status", "active").maybeSingle();
    if (game) await context.admin.from("mafia_game_players").update({ life_status: "disconnected", death_reason: "kicked" }).eq("game_id", game.id).eq("user_id", targetUserId);
  } else {
    await context.admin.from("mafia_room_players").delete().eq("id", target.id);
  }
  await addSystemMessage(context.admin, room, null, `${target.display_name} исключён ведущим.`);
  return getSnapshot(context, roomId);
}

export async function setHostMute(context: CommandContext, roomId: string, targetUserId: string, muted: boolean) {
  await requireHost(context, roomId);
  const { data, error } = await context.admin.from("mafia_room_players").update({
    microphone_blocked: Boolean(muted),
    ...(muted ? { microphone_enabled: false } : {}),
  }).eq("room_id", roomId).eq("user_id", targetUserId).select("id").maybeSingle();
  if (error || !data) throw new CommandError("Игрок не найден", 404, "player_not_found");
  return getSnapshot(context, roomId);
}

export async function addBots(context: CommandContext, roomId: string, requestedCount: number) {
  const room = await requireHost(context, roomId);
  if (room.status !== "lobby") throw new CommandError("Ботов можно добавлять только в лобби", 409, "not_lobby");
  if (!Number.isInteger(requestedCount) || requestedCount < 1) throw new CommandError("Укажите количество ботов");
  const { data, error } = await context.admin
    .from("mafia_room_players")
    .select("id, display_name")
    .eq("room_id", roomId);
  if (error) throw new CommandError("Не удалось загрузить игроков", 500, "players_load_failed");
  const members = data ?? [];
  const availableSlots = room.max_players - members.length;
  const count = Math.min(requestedCount, availableSlots);
  if (count < 1) throw new CommandError("В комнате нет свободных мест", 409, "room_full");
  const usedNames = new Set(members.map((member) => String(member.display_name).toLocaleLowerCase("ru")));
  const rows = Array.from({ length: count }, (_, index) => {
    const displayName = nextBotName(usedNames, members.length + index);
    usedNames.add(displayName.toLocaleLowerCase("ru"));
    return {
      room_id: roomId,
      user_id: null,
      display_name: displayName,
      avatar_url: null,
      is_host: false,
      is_ready: true,
      is_bot: true,
      bot_difficulty: "medium",
      connection_quality: "good",
      last_seen_at: new Date().toISOString(),
    };
  });
  const { error: insertError } = await context.admin.from("mafia_room_players").insert(rows);
  if (insertError) throw new CommandError("Не удалось добавить ботов", 500, "bots_add_failed");
  await addEvent(context.admin, {
    room_id: roomId,
    game_id: null,
    round_number: 0,
    phase: "lobby",
    event_type: "bots_added",
    visibility: "public",
    target_user_id: null,
    payload: { count },
  });
  await addSystemMessage(context.admin, room, null, `Ведущий добавил ботов: ${count}.`);
  return getSnapshot(context, roomId);
}

export async function removeBot(context: CommandContext, roomId: string, roomPlayerId: string) {
  const room = await requireHost(context, roomId);
  if (room.status !== "lobby") throw new CommandError("Ботов можно удалять только в лобби", 409, "not_lobby");
  assertUuid(roomPlayerId, "roomPlayerId");
  const { data: bot, error } = await context.admin
    .from("mafia_room_players")
    .select("id, display_name, is_bot")
    .eq("room_id", roomId)
    .eq("id", roomPlayerId)
    .maybeSingle();
  if (error || !bot || bot.is_bot !== true) throw new CommandError("Бот не найден", 404, "bot_not_found");
  const { error: deleteError } = await context.admin.from("mafia_room_players").delete().eq("id", bot.id);
  if (deleteError) throw new CommandError("Не удалось удалить бота", 500, "bot_remove_failed");
  await addSystemMessage(context.admin, room, null, `${bot.display_name} удалён из тестовой партии.`);
  return getSnapshot(context, roomId);
}

export async function configureRoles(
  context: CommandContext,
  roomId: string,
  mode: "random" | "manual",
  assignments: Record<string, MafiaRole>
) {
  const room = await requireHost(context, roomId);
  if (room.status !== "lobby") throw new CommandError("Роли назначаются только в лобби", 409, "not_lobby");
  if (mode !== "random" && mode !== "manual") throw new CommandError("Некорректный режим назначения ролей");
  const { data, error } = await context.admin
    .from("mafia_room_players")
    .select("id, is_host")
    .eq("room_id", roomId)
    .neq("life_status", "disconnected");
  if (error) throw new CommandError("Не удалось загрузить игроков", 500, "players_load_failed");
  const assignableIds = new Set((data ?? []).filter((player) => !player.is_host).map((player) => String(player.id)));
  const cleanAssignments: Record<string, MafiaRole> = {};
  for (const [playerId, role] of Object.entries(assignments ?? {})) {
    if (!assignableIds.has(playerId)) continue;
    if (!ASSIGNABLE_ROLES.has(role)) throw new CommandError("Выбрана недопустимая роль");
    cleanAssignments[playerId] = role;
  }
  const { error: clearError } = await context.admin.from("mafia_manual_role_assignments").delete().eq("room_id", roomId);
  if (clearError) throw new CommandError("Не удалось очистить прежние роли", 500, "role_configuration_failed");
  if (mode === "manual" && Object.keys(cleanAssignments).length > 0) {
    const { error: insertError } = await context.admin.from("mafia_manual_role_assignments").insert(
      Object.entries(cleanAssignments).map(([roomPlayerId, role]) => ({
        room_id: roomId,
        room_player_id: roomPlayerId,
        role,
      }))
    );
    if (insertError) throw new CommandError("Не удалось сохранить ручные роли", 500, "role_configuration_failed");
  }
  const { error: updateError } = await context.admin.from("mafia_rooms").update({
    settings: {
      ...room.settings,
      roleAssignmentMode: mode,
    },
  }).eq("id", roomId);
  if (updateError) throw new CommandError("Не удалось сохранить назначение ролей", 500, "role_configuration_failed");
  await addEvent(context.admin, {
    room_id: roomId,
    game_id: null,
    round_number: 0,
    phase: "lobby",
    event_type: "role_assignment_configured",
    visibility: "host",
    target_user_id: null,
    payload: { mode, assignedCount: Object.keys(cleanAssignments).length },
  });
  return getSnapshot(context, roomId);
}

export async function cancelRoom(context: CommandContext, roomId: string) {
  const room = await requireHost(context, roomId);
  const game = await getCurrentGame(context.admin, roomId);
  const now = new Date().toISOString();
  if (game?.status === "active") {
    await context.admin.from("mafia_games").update({ status: "cancelled", ended_at: now }).eq("id", game.id);
  }
  const { error } = await context.admin.from("mafia_rooms").update({
    status: "cancelled",
    join_locked: true,
    phase_ends_at: null,
  }).eq("id", roomId);
  if (error) throw new CommandError("Не удалось отменить игру", 500, "room_cancel_failed");
  await addEvent(context.admin, {
    room_id: roomId,
    game_id: game?.id ?? null,
    round_number: game?.round_number ?? 0,
    phase: room.phase,
    event_type: "room_cancelled",
    visibility: "public",
    target_user_id: null,
    payload: { cancelledBy: context.user.id },
  });
  await addSystemMessage(context.admin, room, game, "Ведущий отменил игру.");
  return { cancelled: true };
}

function createCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

function nextBotName(usedNames: Set<string>, seed: number): string {
  for (let offset = 0; offset < BOT_NAMES.length; offset += 1) {
    const candidate = BOT_NAMES[(seed + offset) % BOT_NAMES.length];
    if (!usedNames.has(candidate.toLocaleLowerCase("ru"))) return candidate;
  }
  return `Бот ${seed + 1}`;
}
