import type { CommandContext, EventRow, GamePlayerRow, RoomPlayerRow } from "./types.ts";
import { CommandError, getCurrentGame, getGamePlayers, requireMembership, requireRoom } from "./helpers.ts";

export async function getSnapshot(context: CommandContext, roomId: string) {
  const room = await requireRoom(context.admin, roomId);
  const membership = await requireMembership(context, roomId);
  const { data: roomPlayersData, error: playersError } = await context.admin
    .from("mafia_room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at");
  if (playersError) throw new CommandError("Не удалось загрузить лобби", 500, "lobby_load_failed");
  const roomPlayers = (roomPlayersData ?? []) as RoomPlayerRow[];
  const game = await getCurrentGame(context.admin, roomId);
  const gamePlayers = game ? await getGamePlayers(context.admin, game.id) : [];
  const selfGamePlayer = gamePlayers.find((player) => player.user_id === context.user.id) ?? null;
  const isHost = room.host_user_id === context.user.id;
  const revealAll = game?.status === "finished";
  const mafiaViewer = selfGamePlayer?.team === "mafia" && selfGamePlayer.life_status === "alive";
  const gamePlayerByRoomPlayer = new Map(gamePlayers.map((player) => [player.room_player_id, player]));
  const players = roomPlayers.map((player) => {
    const secret = gamePlayerByRoomPlayer.get(player.id);
    const knownRole = secret && (revealAll || secret.user_id === context.user.id || (mafiaViewer && secret.team === "mafia"))
      ? secret.role
      : null;
    return {
      ...player,
      gamePlayerId: secret?.id ?? null,
      role: knownRole,
      team: knownRole ? secret?.team ?? null : null,
      deathReason: revealAll ? secret?.death_reason ?? null : null,
      score: revealAll ? secret?.score ?? 0 : undefined,
    };
  });

  const { data: eventData, error: eventError } = await context.admin
    .from("mafia_game_events")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (eventError) throw new CommandError("Не удалось загрузить историю", 500, "events_load_failed");
  const events = ((eventData ?? []) as EventRow[])
    .filter((event) => canReadEvent(event, context.user.id, isHost, selfGamePlayer, game?.status === "finished"))
    .reverse();

  const { data: messageData, error: messageError } = await context.admin
    .from("mafia_chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (messageError) throw new CommandError("Не удалось загрузить сообщения", 500, "messages_load_failed");
  const messages = (messageData ?? []).filter((message) =>
    (message.game_id === null || message.game_id === game?.id)
    && canReadChannel(message.channel as string, membership.life_status, selfGamePlayer?.team, room)
  ).reverse();

  let voteCounts: Record<string, number> | undefined;
  if (game && (game.phase === "day_execution" || game.status === "finished")) {
    const { data: votes } = await context.admin
      .from("mafia_game_votes")
      .select("target_game_player_id")
      .eq("game_id", game.id)
      .eq("round_number", game.round_number);
    voteCounts = (votes ?? []).reduce<Record<string, number>>((result, vote) => {
      const targetId = String(vote.target_game_player_id);
      result[targetId] = (result[targetId] ?? 0) + 1;
      return result;
    }, {});
  }

  return {
    room,
    game,
    players,
    self: {
      roomPlayerId: membership.id,
      gamePlayerId: selfGamePlayer?.id ?? null,
      role: selfGamePlayer?.role ?? null,
      team: selfGamePlayer?.team ?? null,
      lifeStatus: selfGamePlayer?.life_status ?? membership.life_status,
      isHost,
      roleAcknowledgedAt: selfGamePlayer?.role_acknowledged_at ?? null,
    },
    events,
    messages,
    voteCounts,
    serverTime: new Date().toISOString(),
  };
}

export async function getMyRooms(context: CommandContext) {
  const { data: memberships, error } = await context.admin
    .from("mafia_room_players")
    .select("room_id, is_host, joined_at")
    .eq("user_id", context.user.id)
    .order("joined_at", { ascending: false })
    .limit(10);
  if (error) throw new CommandError("Не удалось загрузить недавние комнаты", 500, "recent_rooms_failed");
  const roomIds = (memberships ?? []).map((membership) => membership.room_id);
  if (roomIds.length === 0) return [];
  const { data: rooms, error: roomsError } = await context.admin.from("mafia_rooms").select("*").in("id", roomIds);
  if (roomsError) throw new CommandError("Не удалось загрузить недавние комнаты", 500, "recent_rooms_failed");
  const order = new Map(roomIds.map((id, index) => [id, index]));
  return (rooms ?? []).sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

function canReadEvent(
  event: EventRow,
  userId: string,
  isHost: boolean,
  self: GamePlayerRow | null,
  revealAll = false
) {
  if (revealAll) return true;
  if (isHost) return true;
  if (event.visibility === "public") return true;
  if (event.visibility === "host") return false;
  if (event.visibility === "private") return event.target_user_id === userId;
  if (event.visibility === "mafia") return self?.team === "mafia" && self.life_status === "alive";
  return event.visibility === "dead" && self?.life_status === "dead";
}

function canReadChannel(channel: string, lifeStatus: string, team: string | undefined, room: Record<string, unknown>) {
  if (channel === "room_chat" || channel === "system_chat") return true;
  if (channel === "alive_chat") return lifeStatus === "alive" || room.dead_can_read_alive_chat === true;
  if (channel === "mafia_chat") return lifeStatus === "alive" && team === "mafia";
  return channel === "dead_chat" && lifeStatus === "dead" && room.dead_chat_enabled === true;
}
