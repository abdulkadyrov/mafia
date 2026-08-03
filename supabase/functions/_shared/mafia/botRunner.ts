import {
  chooseMediumBotNightTarget,
  chooseMediumBotVote,
  mediumBotDiscussionLine,
  type BotMindPlayer,
} from "../../../../src/core/game/botStrategy.ts";
import type { GamePhase, NightActionType } from "../../../../src/core/game/gameTypes.ts";
import { getRoleDefinition } from "../../../../src/core/roles/roleRegistry.ts";
import type { CommandContext, GameActionRow, GamePlayerRow, GameRow, RoomRow } from "./types.ts";
import { addEvent, CommandError, randomUnit } from "./helpers.ts";

export async function runBotsForPhase(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  players: GamePlayerRow[],
  phase: Exclude<GamePhase, "lobby">,
  roundNumber: number
): Promise<void> {
  const bots = players.filter((player) => player.is_bot && player.life_status === "alive" && !player.is_host);
  if (bots.length === 0) return;
  if (phase === "role_reveal") return acknowledgeBotRoles(context, room, game, bots);
  if (phase === "day_discussion") return postBotDiscussion(context, room, game, players, bots, roundNumber);
  if (phase === "day_voting") return submitBotVotes(context, game, players, bots, roundNumber);
  if (phase.startsWith("night_")) return submitBotNightActions(context, room, game, players, bots, phase, roundNumber);
}

async function acknowledgeBotRoles(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  bots: GamePlayerRow[]
) {
  const now = new Date().toISOString();
  const pending = bots.filter((bot) => !bot.role_acknowledged_at);
  if (pending.length === 0) return;
  const { error } = await context.admin
    .from("mafia_game_players")
    .update({ role_acknowledged_at: now })
    .in("id", pending.map((bot) => bot.id));
  if (error) throw new CommandError("Боты не смогли подтвердить роли", 500, "bot_role_ack_failed");
  for (const bot of pending) {
    bot.role_acknowledged_at = now;
    await addEvent(context.admin, {
      room_id: room.id,
      game_id: game.id,
      round_number: game.round_number,
      phase: "role_reveal",
      event_type: "role_acknowledged",
      visibility: "public",
      target_user_id: null,
      payload: { userId: `bot:${bot.room_player_id}`, isBot: true },
    });
  }
}

async function submitBotNightActions(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  players: GamePlayerRow[],
  bots: GamePlayerRow[],
  phase: Exclude<GamePhase, "lobby">,
  roundNumber: number
) {
  const { data, error } = await context.admin
    .from("mafia_game_actions")
    .select("*")
    .eq("game_id", game.id);
  if (error) throw new CommandError("Не удалось подготовить действия ботов", 500, "bot_actions_load_failed");
  const actions = (data ?? []) as GameActionRow[];
  const existingActorIds = new Set(actions
    .filter((action) => action.round_number === roundNumber && action.phase === phase)
    .map((action) => action.actor_game_player_id));
  const mindPlayers = players.map(toMindPlayer);
  const pressure = await loadVotePressure(context, game.id);

  for (const bot of bots) {
    const actionType = getRoleDefinition(bot.role).nightAction;
    if (!actionType || actionPhase(actionType) !== phase || existingActorIds.has(bot.id)) continue;
    const previousTargetIds = actions
      .filter((action) => action.actor_game_player_id === bot.id && action.target_game_player_id)
      .map((action) => action.target_game_player_id!);
    const checkedPlayerIds = actions
      .filter((action) => action.actor_game_player_id === bot.id && action.action_type === "commissioner_check" && action.target_game_player_id)
      .map((action) => action.target_game_player_id!);
    const doctorSelfHealCount = actionType === "doctor_heal"
      ? actions.filter((action) => action.actor_game_player_id === bot.id && action.target_game_player_id === bot.id && action.action_type === "doctor_heal").length
      : 0;
    const eligiblePlayers = actionType === "doctor_heal" && doctorSelfHealCount >= Number(room.settings.doctorSelfHealsLimit ?? 1)
      ? mindPlayers.filter((player) => player.id !== bot.id)
      : mindPlayers;
    const target = chooseMediumBotNightTarget(toMindPlayer(bot), eligiblePlayers, {
      pressureByTarget: pressure,
      previousTargetIds,
      checkedPlayerIds,
    }, randomUnit);
    if (!target) continue;
    const { error: insertError } = await context.admin.from("mafia_game_actions").insert({
      game_id: game.id,
      round_number: roundNumber,
      phase,
      actor_game_player_id: bot.id,
      target_game_player_id: target.id,
      action_type: actionType,
    });
    if (insertError?.code === "23505") continue;
    if (insertError) throw new CommandError("Бот не смог выполнить ночное действие", 500, "bot_action_failed");
    await addEvent(context.admin, {
      room_id: room.id,
      game_id: game.id,
      round_number: roundNumber,
      phase,
      event_type: "night_action_submitted",
      visibility: bot.team === "mafia" ? "mafia" : "host",
      target_user_id: null,
      payload: { actorId: bot.id, targetId: target.id, actionType, isBot: true },
    });
  }
}

async function submitBotVotes(
  context: CommandContext,
  game: GameRow,
  players: GamePlayerRow[],
  bots: GamePlayerRow[],
  roundNumber: number
) {
  const { data: voteData, error } = await context.admin
    .from("mafia_game_votes")
    .select("voter_game_player_id, target_game_player_id, round_number")
    .eq("game_id", game.id);
  if (error) throw new CommandError("Не удалось подготовить голоса ботов", 500, "bot_votes_load_failed");
  const votes = voteData ?? [];
  const existingVoters = new Set(votes
    .filter((vote) => vote.round_number === roundNumber)
    .map((vote) => String(vote.voter_game_player_id)));
  const pressure = votes.reduce<Record<string, number>>((result, vote) => {
    const targetId = String(vote.target_game_player_id);
    result[targetId] = (result[targetId] ?? 0) + 1;
    return result;
  }, {});
  const { data: checkData } = await context.admin
    .from("mafia_game_actions")
    .select("actor_game_player_id, target_game_player_id")
    .eq("game_id", game.id)
    .eq("action_type", "commissioner_check");
  const mindPlayers = players.map(toMindPlayer);

  for (const bot of bots) {
    if (existingVoters.has(bot.id)) continue;
    const checkedByBot = (checkData ?? [])
      .filter((check) => check.actor_game_player_id === bot.id && check.target_game_player_id)
      .map((check) => String(check.target_game_player_id));
    const knownMafiaIds = checkedByBot.filter((id) => players.find((player) => player.id === id)?.team === "mafia");
    const target = chooseMediumBotVote(toMindPlayer(bot), mindPlayers, {
      pressureByTarget: pressure,
      knownMafiaIds,
    }, randomUnit);
    if (!target) continue;
    const { error: insertError } = await context.admin.from("mafia_game_votes").insert({
      game_id: game.id,
      round_number: roundNumber,
      voter_game_player_id: bot.id,
      target_game_player_id: target.id,
    });
    if (insertError?.code === "23505") continue;
    if (insertError) throw new CommandError("Бот не смог проголосовать", 500, "bot_vote_failed");
    pressure[target.id] = (pressure[target.id] ?? 0) + 1;
  }
}

async function postBotDiscussion(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  players: GamePlayerRow[],
  bots: GamePlayerRow[],
  roundNumber: number
) {
  if (!room.chat_enabled) return;
  const pressure = await loadVotePressure(context, game.id);
  const mindPlayers = players.map(toMindPlayer);
  const roomPlayerIds = players.map((player) => player.room_player_id);
  const { data: roomPlayers } = await context.admin
    .from("mafia_room_players")
    .select("id, display_name")
    .in("id", roomPlayerIds);
  const nameByRoomPlayer = new Map((roomPlayers ?? []).map((player) => [String(player.id), String(player.display_name)]));
  const gameNameById = new Map(players.map((player) => [player.id, nameByRoomPlayer.get(player.room_player_id) ?? "игрок"]));

  for (const bot of bots.slice(0, 3)) {
    const target = chooseMediumBotVote(toMindPlayer(bot), mindPlayers, { pressureByTarget: pressure }, randomUnit);
    const authorName = nameByRoomPlayer.get(bot.room_player_id) ?? "Бот";
    const content = mediumBotDiscussionLine(authorName, target ? gameNameById.get(target.id) ?? null : null, randomUnit);
    const { error } = await context.admin.from("mafia_chat_messages").insert({
      room_id: room.id,
      game_id: game.id,
      author_user_id: null,
      author_name: `${authorName} · BOT`,
      channel: "alive_chat",
      content,
      client_nonce: crypto.randomUUID(),
    });
    if (error) throw new CommandError("Бот не смог отправить сообщение", 500, "bot_chat_failed");
    await addEvent(context.admin, {
      room_id: room.id,
      game_id: game.id,
      round_number: roundNumber,
      phase: "day_discussion",
      event_type: "bot_spoke",
      visibility: "host",
      target_user_id: null,
      payload: { actorId: bot.id },
    });
  }
}

async function loadVotePressure(context: CommandContext, gameId: string): Promise<Record<string, number>> {
  const { data } = await context.admin
    .from("mafia_game_votes")
    .select("target_game_player_id")
    .eq("game_id", gameId);
  return (data ?? []).reduce<Record<string, number>>((result, vote) => {
    const targetId = String(vote.target_game_player_id);
    result[targetId] = (result[targetId] ?? 0) + 1;
    return result;
  }, {});
}

function actionPhase(action: NightActionType): Exclude<GamePhase, "lobby"> {
  if (action === "doctor_heal" || action === "bodyguard_protect") return "night_doctor";
  if (action === "commissioner_check" || action === "commissioner_kill") return "night_commissioner";
  return "night_mafia";
}

function toMindPlayer(player: GamePlayerRow): BotMindPlayer {
  return {
    id: player.id,
    role: player.role,
    team: player.team,
    lifeStatus: player.life_status,
    isModerator: player.team === "host",
  };
}
