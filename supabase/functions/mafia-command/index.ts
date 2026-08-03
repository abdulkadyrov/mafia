import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendChatMessage } from "../_shared/mafia/chatCommands.ts";
import { acknowledgeRole, advancePhase, rematch, startGame, submitNightAction, submitVote } from "../_shared/mafia/gameCommands.ts";
import { CommandError } from "../_shared/mafia/helpers.ts";
import {
  createRoom,
  addBots,
  cancelRoom,
  configureRoles,
  joinRoom,
  kickPlayer,
  leaveRoom,
  removeBot,
  setHostMute,
  setJoinLocked,
  setMediaStatus,
  setReady,
  transferHost,
  updateRoom,
} from "../_shared/mafia/roomCommands.ts";
import { getMyRooms, getSnapshot } from "../_shared/mafia/snapshot.ts";
import type { CommandContext, Json, MafiaCommand } from "../_shared/mafia/types.ts";

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Метод не поддерживается", code: "method_not_allowed" }, 405, headers);

  try {
    const context = await createContext(request);
    const command = await parseCommand(request);
    const tracked = command.type !== "snapshot" && command.type !== "my_rooms";
    if (tracked) {
      const claim = await claimCommand(context, command);
      if (claim.replayed) return json({ data: claim.response, replayed: true }, 200, headers);
    }

    try {
      const result = await dispatch(context, command);
      if (tracked) await completeCommand(context, command, result);
      return json({ data: result }, 200, headers);
    } catch (error) {
      if (tracked) await releaseCommand(context, command.commandId);
      throw error;
    }
  } catch (error) {
    const normalized = error instanceof CommandError
      ? error
      : new CommandError("Не удалось выполнить команду", 500, "internal_error");
    if (!(error instanceof CommandError)) {
      console.error("mafia-command failed", error instanceof Error ? error.message : "unknown");
    }
    return json({ error: normalized.message, code: normalized.code }, normalized.status, headers);
  }
});

async function createContext(request: Request): Promise<CommandContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !publishableKey || !secretKey) throw new CommandError("Сервер не настроен", 503, "server_not_configured");
  if (!authorization?.startsWith("Bearer ")) throw new CommandError("Войдите в аккаунт", 401, "unauthorized");

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: { user }, error } = await caller.auth.getUser(token);
  if (error || !user) throw new CommandError("Сессия истекла", 401, "session_expired");
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user, admin };
}

async function parseCommand(request: Request): Promise<MafiaCommand> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new CommandError("Некорректный JSON");
  }
  if (!value || typeof value !== "object") throw new CommandError("Команда не передана");
  const command = value as Partial<MafiaCommand>;
  if (typeof command.commandId !== "string" || !/^[0-9a-f-]{36}$/i.test(command.commandId)) {
    throw new CommandError("Некорректный commandId");
  }
  if (typeof command.type !== "string") throw new CommandError("Тип команды не передан");
  return command as MafiaCommand;
}

async function dispatch(context: CommandContext, command: MafiaCommand): Promise<unknown> {
  switch (command.type) {
    case "snapshot": return getSnapshot(context, command.roomId);
    case "my_rooms": return getMyRooms(context);
    case "create_room": return createRoom(context, command.settings);
    case "join_room": return joinRoom(context, command.code);
    case "leave_room": return leaveRoom(context, command.roomId);
    case "set_ready": return setReady(context, command.roomId, command.ready);
    case "set_media_status": return setMediaStatus(
      context,
      command.roomId,
      command.cameraEnabled,
      command.microphoneEnabled,
      command.connectionQuality
    );
    case "update_room": return updateRoom(context, command.roomId, command.settings);
    case "set_join_locked": return setJoinLocked(context, command.roomId, command.locked);
    case "transfer_host": return transferHost(context, command.roomId, command.targetUserId);
    case "kick_player": return kickPlayer(context, command.roomId, command.targetUserId);
    case "set_host_mute": return setHostMute(context, command.roomId, command.targetUserId, command.muted);
    case "add_bots": return addBots(context, command.roomId, command.count);
    case "remove_bot": return removeBot(context, command.roomId, command.roomPlayerId);
    case "configure_roles": return configureRoles(context, command.roomId, command.mode, command.assignments);
    case "cancel_room": return cancelRoom(context, command.roomId);
    case "start_game": return startGame(context, command.roomId);
    case "acknowledge_role": return acknowledgeRole(context, command.roomId);
    case "night_action": return submitNightAction(context, command.roomId, command.actionType, command.targetGamePlayerId);
    case "vote": return submitVote(context, command.roomId, command.targetGamePlayerId);
    case "advance_phase": return advancePhase(context, command.roomId, command.expectedVersion);
    case "rematch": return rematch(context, command.roomId);
    case "send_chat": return sendChatMessage(context, command.roomId, command.channel, command.content, command.clientNonce);
    default: throw new CommandError("Неизвестная команда", 400, "unknown_command");
  }
}

async function claimCommand(context: CommandContext, command: MafiaCommand): Promise<{ replayed: boolean; response?: unknown }> {
  const roomId = "roomId" in command ? command.roomId : null;
  const { error: insertError } = await context.admin.from("mafia_game_commands").insert({
    id: command.commandId,
    room_id: roomId,
    user_id: context.user.id,
    command_type: command.type,
    response: null,
  });
  if (!insertError) return { replayed: false };
  if (insertError.code !== "23505") throw new CommandError("Не удалось зарегистрировать команду", 500, "idempotency_claim_failed");

  const { data, error } = await context.admin
    .from("mafia_game_commands")
    .select("user_id, command_type, response")
    .eq("id", command.commandId)
    .maybeSingle();
  if (error) throw new CommandError("Не удалось проверить команду", 500, "idempotency_check_failed");
  if (!data) throw new CommandError("Команда временно недоступна", 409, "command_in_progress");
  if (data.user_id !== context.user.id) throw new CommandError("Идентификатор команды уже использован", 409, "command_id_conflict");
  if (data.command_type !== command.type) throw new CommandError("Идентификатор команды относится к другому действию", 409, "command_id_conflict");
  if (data.response === null) throw new CommandError("Команда уже выполняется", 409, "command_in_progress");
  return { replayed: true, response: data.response };
}

async function completeCommand(context: CommandContext, command: MafiaCommand, result: unknown): Promise<void> {
  const roomId = "roomId" in command ? command.roomId : getRoomId(result);
  const { error } = await context.admin.from("mafia_game_commands").update({
    room_id: roomId,
    response: result as Json,
  }).eq("id", command.commandId).eq("user_id", context.user.id);
  if (error) {
    console.error("failed to store idempotency response", error.message);
  }
}

async function releaseCommand(context: CommandContext, commandId: string): Promise<void> {
  await context.admin.from("mafia_game_commands").delete().eq("id", commandId).eq("user_id", context.user.id).is("response", null);
}

function getRoomId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const room = (result as { room?: { id?: unknown } }).room;
  return typeof room?.id === "string" ? room.id : null;
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
