import { canSendChat, normalizeChatMessage } from "../../../../src/core/chat/chatPermissions.ts";
import type { ChatChannel } from "../../../../src/core/chat/chatTypes.ts";
import type { CommandContext } from "./types.ts";
import { CommandError, getCurrentGame, requireMembership, requireRoom } from "./helpers.ts";

export async function sendChatMessage(
  context: CommandContext,
  roomId: string,
  channel: ChatChannel,
  rawContent: string,
  clientNonce: string
) {
  const room = await requireRoom(context.admin, roomId);
  const member = await requireMembership(context, roomId);
  const content = normalizeChatMessage(rawContent);
  if (!/^[0-9a-f-]{36}$/i.test(clientNonce)) throw new CommandError("Некорректный идентификатор сообщения");
  const game = await getCurrentGame(context.admin, roomId);
  let team: "mafia" | "city" | "neutral" | "host" = member.is_host ? "host" : "city";
  let lifeStatus = member.life_status;

  if (game) {
    const { data: gamePlayer } = await context.admin
      .from("mafia_game_players")
      .select("team, life_status")
      .eq("game_id", game.id)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (gamePlayer) {
      team = gamePlayer.team;
      lifeStatus = gamePlayer.life_status;
    }
  }

  const allowed = canSendChat(
    { lifeStatus, team, blocked: false },
    channel,
    room.phase,
    {
      chatEnabled: room.chat_enabled,
      deadChatEnabled: room.dead_chat_enabled,
      deadCanReadAliveChat: room.dead_can_read_alive_chat,
    }
  );
  if (!allowed) throw new CommandError("Вам нельзя писать в этот чат сейчас", 403, "chat_forbidden");

  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  const { count } = await context.admin
    .from("mafia_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("author_user_id", context.user.id)
    .gte("created_at", tenSecondsAgo);
  if ((count ?? 0) >= 5) throw new CommandError("Слишком много сообщений. Подождите немного", 429, "chat_rate_limited");

  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
  const { data: duplicate } = await context.admin
    .from("mafia_chat_messages")
    .select("id")
    .eq("author_user_id", context.user.id)
    .eq("content", content)
    .gte("created_at", thirtySecondsAgo)
    .limit(1)
    .maybeSingle();
  if (duplicate) throw new CommandError("Не отправляйте одно сообщение несколько раз", 429, "chat_duplicate");

  const { data, error } = await context.admin
    .from("mafia_chat_messages")
    .insert({
      room_id: roomId,
      game_id: game?.id ?? null,
      author_user_id: context.user.id,
      author_name: member.display_name,
      channel,
      content,
      client_nonce: clientNonce,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { duplicate: true };
    throw new CommandError("Не удалось отправить сообщение", 500, "chat_send_failed");
  }
  return data;
}
