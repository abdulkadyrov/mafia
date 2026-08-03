import { getNextPhase } from "../../../../src/core/game/phaseMachine.ts";
import { resolveNight } from "../../../../src/core/game/nightResolution.ts";
import { resolveVotes } from "../../../../src/core/game/voting.ts";
import { getWinner } from "../../../../src/core/game/winCondition.ts";
import type { DomainGamePlayer, DomainNightAction, GamePhase, NightActionType } from "../../../../src/core/game/gameTypes.ts";
import { assignRoles, buildRoleDeck } from "../../../../src/core/roles/roleAssignment.ts";
import { getRoleDefinition } from "../../../../src/core/roles/roleRegistry.ts";
import type { RoleCounts } from "../../../../src/core/roles/roleTypes.ts";
import type { CommandContext, GameActionRow, GamePlayerRow, GameRow, RoomPlayerRow, RoomRow } from "./types.ts";
import {
  addEvent,
  addSystemMessage,
  CommandError,
  getCurrentGame,
  getDefaultRoleCounts,
  getGamePlayers,
  phaseTimes,
  randomUnit,
  requireActiveGame,
  requireHost,
  requireMembership,
  requireRoom,
} from "./helpers.ts";
import { getSnapshot } from "./snapshot.ts";
import { runBotsForPhase } from "./botRunner.ts";

export async function startGame(context: CommandContext, roomId: string) {
  const room = await requireHost(context, roomId);
  if (room.status !== "lobby") throw new CommandError("Партия уже началась", 409, "game_already_started");
  const { data: memberData, error: membersError } = await context.admin
    .from("mafia_room_players")
    .select("*")
    .eq("room_id", roomId)
    .neq("life_status", "disconnected")
    .order("joined_at");
  if (membersError) throw new CommandError("Не удалось загрузить игроков", 500, "players_load_failed");
  const members = (memberData ?? []) as RoomPlayerRow[];
  if (members.length < 6) throw new CommandError("Для production-партии требуется минимум 6 игроков", 409, "not_enough_players");
  const unready = members.filter((member) => !member.is_host && !member.is_ready);
  if (unready.length > 0) throw new CommandError(`Не готовы: ${unready.map((member) => member.display_name).join(", ")}`, 409, "players_not_ready");
  if (room.camera_required && members.some((member) => !member.is_bot && !member.camera_enabled)) {
    throw new CommandError("В комнате обязательна камера: не все игроки её включили", 409, "camera_required");
  }
  const hostMember = members.find((member) => member.user_id === room.host_user_id);
  if (!hostMember) throw new CommandError("Ведущий не найден в комнате", 409, "host_missing");
  const hostPlays = room.settings.hostPlays !== false;
  const activeMembers = hostPlays ? members : members.filter((member) => member.id !== hostMember.id);
  const roleCounts = getDefaultRoleCounts(activeMembers.length, room);
  try {
    buildRoleDeck(roleCounts, activeMembers.length);
  } catch (error) {
    throw new CommandError(
      error instanceof Error ? error.message : "Проверьте количество ролей",
      409,
      "invalid_role_settings"
    );
  }

  const previous = await getCurrentGame(context.admin, roomId);
  if (previous?.status === "active") throw new CommandError("Партия уже активна", 409, "game_already_started");
  const gameNumber = (previous?.number ?? 0) + 1;
  const { data: gameData, error: gameError } = await context.admin
    .from("mafia_games")
    .insert({ room_id: roomId, number: gameNumber, status: "active", phase: "role_reveal", round_number: 1 })
    .select("*")
    .single();
  if (gameError || !gameData) throw new CommandError("Не удалось создать партию", 500, "game_create_failed");
  const game = gameData as GameRow;

  try {
    const playerAssignments = room.settings.roleAssignmentMode === "manual"
      ? await buildManualAssignments(context, activeMembers, roleCounts, room)
      : assignRoles(activeMembers.map((member) => member.id), roleCounts, randomUnit);
    const assignments = hostPlays ? playerAssignments : [
      ...playerAssignments,
      { playerId: hostMember.id, role: "host" as const, team: "host" as const },
    ];
    const memberById = new Map(members.map((member) => [member.id, member]));
    const rows = assignments.map((assignment) => {
      const member = memberById.get(assignment.playerId)!;
      return {
        game_id: game.id,
        room_player_id: member.id,
        user_id: member.user_id,
        role: assignment.role,
        team: assignment.team,
        life_status: "alive",
        is_host: member.user_id === room.host_user_id,
        is_bot: member.is_bot,
        bot_difficulty: member.bot_difficulty,
        role_acknowledged_at: null,
      };
    });
    const { error: insertPlayersError } = await context.admin.from("mafia_game_players").insert(rows);
    if (insertPlayersError) throw insertPlayersError;
    await context.admin.from("mafia_room_players").update({
      life_status: "alive",
      microphone_enabled: false,
      microphone_blocked: false,
    }).eq("room_id", roomId);
    const times = phaseTimes(room, "role_reveal");
    const { error: roomError } = await context.admin.from("mafia_rooms").update({
      status: "active",
      phase: "role_reveal",
      round_number: 1,
      phase_version: room.phase_version + 1,
      join_locked: true,
      ...times,
    }).eq("id", roomId).eq("phase_version", room.phase_version);
    if (roomError) throw roomError;
    await addEvent(context.admin, {
      room_id: roomId,
      game_id: game.id,
      round_number: 1,
      phase: "role_reveal",
      event_type: "game_started",
      visibility: "public",
      target_user_id: null,
      payload: { gameNumber, roleAssignmentMode: room.settings.roleAssignmentMode ?? "random", hostPlays },
    });
    await addSystemMessage(context.admin, room, game, "Партия началась. Роли распределены.");
    const createdPlayers = await getGamePlayers(context.admin, game.id);
    await runBotsForPhase(context, room, game, createdPlayers, "role_reveal", 1);
  } catch (error) {
    await context.admin.from("mafia_games").delete().eq("id", game.id);
    if (error instanceof CommandError) throw error;
    console.error("start game failed", error instanceof Error ? error.message : "unknown");
    throw new CommandError("Не удалось безопасно распределить роли", 500, "role_assignment_failed");
  }
  return getSnapshot(context, roomId);
}

export async function acknowledgeRole(context: CommandContext, roomId: string) {
  await requireMembership(context, roomId);
  const game = await requireActiveGame(context.admin, roomId);
  if (game.phase !== "role_reveal") throw new CommandError("Этап просмотра роли завершён", 409, "role_reveal_closed");
  const { error } = await context.admin.from("mafia_game_players").update({ role_acknowledged_at: new Date().toISOString() }).eq("game_id", game.id).eq("user_id", context.user.id);
  if (error) throw new CommandError("Не удалось подтвердить роль", 500, "role_ack_failed");
  await addEvent(context.admin, {
    room_id: roomId,
    game_id: game.id,
    round_number: game.round_number,
    phase: "role_reveal",
    event_type: "role_acknowledged",
    visibility: "public",
    target_user_id: null,
    payload: { userId: context.user.id },
  });
  return getSnapshot(context, roomId);
}

export async function submitNightAction(
  context: CommandContext,
  roomId: string,
  actionType: NightActionType,
  targetGamePlayerId: string
) {
  const room = await requireRoom(context.admin, roomId);
  await requireMembership(context, roomId);
  const game = await requireActiveGame(context.admin, roomId);
  if (room.phase_ends_at && Date.now() >= new Date(room.phase_ends_at).getTime()) {
    throw new CommandError("Время ночного действия истекло", 409, "night_action_expired");
  }
  const players = await getGamePlayers(context.admin, game.id);
  const actor = players.find((player) => player.user_id === context.user.id);
  const target = players.find((player) => player.id === targetGamePlayerId);
  if (!actor || !target) throw new CommandError("Игрок не найден", 404, "player_not_found");
  if (actor.life_status !== "alive" || target.life_status !== "alive") throw new CommandError("Погибший игрок не может участвовать в действии", 403, "dead_player");
  if (target.team === "host") throw new CommandError("Ведущий-наблюдатель не является игровой целью", 403, "host_target_forbidden");
  validateNightAction(game.phase, actor, target, actionType);

  if (actionType === "doctor_heal" && actor.id === target.id) {
    const { count } = await context.admin
      .from("mafia_game_actions")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id)
      .eq("actor_game_player_id", actor.id)
      .eq("target_game_player_id", actor.id)
      .eq("action_type", "doctor_heal");
    if ((count ?? 0) >= Number(room.settings.doctorSelfHealsLimit ?? 1)) {
      throw new CommandError("Лимит самолечения уже использован", 409, "self_heal_limit");
    }
  }

  const values = {
    game_id: game.id,
    round_number: game.round_number,
    phase: game.phase,
    actor_game_player_id: actor.id,
    target_game_player_id: target.id,
    action_type: actionType,
  };
  const result = actionType === "mafia_kill"
    ? await context.admin.from("mafia_game_actions").upsert(values, {
      onConflict: "game_id,round_number,actor_game_player_id,phase",
    })
    : await context.admin.from("mafia_game_actions").insert(values);
  if (result.error?.code === "23505") throw new CommandError("Действие этой ночи уже сохранено", 409, "action_already_submitted");
  if (result.error) throw new CommandError("Не удалось сохранить действие", 500, "action_submit_failed");

  await addEvent(context.admin, {
    room_id: roomId,
    game_id: game.id,
    round_number: game.round_number,
    phase: game.phase,
    event_type: "night_action_submitted",
    visibility: actor.team === "mafia" ? "mafia" : "private",
    target_user_id: actor.team === "mafia" ? null : actor.user_id,
    payload: { actorId: actor.id, targetId: target.id, actionType },
  });
  return { accepted: true };
}

export async function submitVote(context: CommandContext, roomId: string, targetGamePlayerId: string) {
  const room = await requireRoom(context.admin, roomId);
  await requireMembership(context, roomId);
  const game = await requireActiveGame(context.admin, roomId);
  if (game.phase !== "day_voting") throw new CommandError("Сейчас голосование недоступно", 409, "voting_closed");
  if (room.phase_ends_at && Date.now() >= new Date(room.phase_ends_at).getTime()) {
    throw new CommandError("Время голосования истекло", 409, "voting_expired");
  }
  const players = await getGamePlayers(context.admin, game.id);
  const voter = players.find((player) => player.user_id === context.user.id);
  const target = players.find((player) => player.id === targetGamePlayerId);
  if (!voter || !target) throw new CommandError("Игрок не найден", 404, "player_not_found");
  if (voter.life_status !== "alive" || target.life_status !== "alive" || voter.team === "host" || target.team === "host") {
    throw new CommandError("Этот голос недопустим", 403, "vote_forbidden");
  }
  const values = {
    game_id: game.id,
    round_number: game.round_number,
    voter_game_player_id: voter.id,
    target_game_player_id: target.id,
  };
  const allowChange = room.settings.allowVoteChange === true;
  const result = allowChange
    ? await context.admin.from("mafia_game_votes").upsert(values, { onConflict: "game_id,round_number,voter_game_player_id" })
    : await context.admin.from("mafia_game_votes").insert(values);
  if (result.error?.code === "23505") throw new CommandError("Вы уже проголосовали", 409, "vote_already_submitted");
  if (result.error) throw new CommandError("Не удалось сохранить голос", 500, "vote_submit_failed");
  return { accepted: true };
}

export async function advancePhase(context: CommandContext, roomId: string, expectedVersion: number) {
  const room = await requireRoom(context.admin, roomId);
  const membership = await requireMembership(context, roomId);
  const canAutoAdvance = room.auto_phase && room.phase_ends_at && Date.now() >= new Date(room.phase_ends_at).getTime();
  if (!membership.is_host && !canAutoAdvance) throw new CommandError("Фазу переключает ведущий", 403, "host_required");
  if (room.phase_version !== expectedVersion) throw new CommandError("Фаза уже изменилась", 409, "stale_phase");
  const game = await requireActiveGame(context.admin, roomId);
  const players = await getGamePlayers(context.admin, game.id);

  if (game.phase === "role_reveal") {
    const waiting = players.filter((player) => player.life_status !== "disconnected" && !player.role_acknowledged_at);
    if (waiting.length > 0) throw new CommandError("Не все игроки подтвердили роли", 409, "roles_not_acknowledged");
  }

  if (game.phase === "night_resolution") {
    const finished = await resolveNightOnServer(context, room, game, players);
    if (finished) return getSnapshot(context, roomId);
    return movePhase(context, room, game, "day_announcement", game.round_number);
  }
  if (game.phase === "day_voting") {
    const outcome = await resolveVotingOnServer(context, room, game, players);
    if (outcome === "finished") return getSnapshot(context, roomId);
    if (outcome === "revote") return movePhase(context, room, game, "day_voting", game.round_number);
    return movePhase(context, room, game, "day_execution", game.round_number);
  }

  const aliveRoles = players.filter((player) => player.life_status === "alive").map((player) => player.role);
  const next = getNextPhase(game.phase, aliveRoles);
  if (!next || next === "game_over" || next === "lobby") throw new CommandError("Нет допустимого перехода фазы", 409, "invalid_phase_transition");
  const nextRound = game.phase === "day_execution" ? game.round_number + 1 : game.round_number;
  return movePhase(context, room, game, next, nextRound);
}

export async function rematch(context: CommandContext, roomId: string) {
  const room = await requireHost(context, roomId);
  const game = await getCurrentGame(context.admin, roomId);
  if (!game || game.status !== "finished") throw new CommandError("Текущая партия ещё не завершена", 409, "game_not_finished");
  await context.admin.from("mafia_room_players").update({
    life_status: "alive",
    is_ready: true,
    microphone_blocked: false,
    microphone_enabled: false,
  }).eq("room_id", roomId).neq("life_status", "disconnected");
  await context.admin.from("mafia_rooms").update({
    status: "lobby",
    phase: "lobby",
    phase_version: room.phase_version + 1,
    round_number: 0,
    phase_started_at: null,
    phase_ends_at: null,
  }).eq("id", roomId);
  return startGame(context, roomId);
}

async function movePhase(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  next: Exclude<GamePhase, "lobby">,
  roundNumber: number
) {
  const times = phaseTimes(room, next);
  const { data: updatedGame, error: gameError } = await context.admin.from("mafia_games").update({
    phase: next,
    phase_version: game.phase_version + 1,
    round_number: roundNumber,
  }).eq("id", game.id).eq("phase_version", game.phase_version).select("id").maybeSingle();
  if (gameError || !updatedGame) throw new CommandError("Фаза уже была изменена", 409, "phase_conflict");
  const { data: updatedRoom, error: roomError } = await context.admin.from("mafia_rooms").update({
    phase: next,
    phase_version: room.phase_version + 1,
    round_number: roundNumber,
    ...times,
  }).eq("id", room.id).eq("phase_version", room.phase_version).select("id").maybeSingle();
  if (roomError || !updatedRoom) throw new CommandError("Фаза комнаты уже была изменена", 409, "phase_conflict");
  await addEvent(context.admin, {
    room_id: room.id,
    game_id: game.id,
    round_number: roundNumber,
    phase: next,
    event_type: "phase_changed",
    visibility: "public",
    target_user_id: null,
    payload: { from: game.phase, to: next },
  });
  await addSystemMessage(context.admin, room, game, phaseAnnouncement(next));
  const players = await getGamePlayers(context.admin, game.id);
  await runBotsForPhase(context, room, game, players, next, roundNumber);
  return getSnapshot(context, room.id);
}

async function resolveNightOnServer(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  players: GamePlayerRow[]
): Promise<boolean> {
  const { data: actionData, error } = await context.admin.from("mafia_game_actions").select("*").eq("game_id", game.id).eq("round_number", game.round_number);
  if (error) throw new CommandError("Не удалось обработать ночь", 500, "night_resolution_failed");
  const actions = (actionData ?? []) as GameActionRow[];
  const resolution = resolveNight(
    players.map(toDomainPlayer),
    actions.filter((action) => action.target_game_player_id).map((action) => ({
      actorId: action.actor_game_player_id,
      targetId: action.target_game_player_id!,
      type: action.action_type,
    } satisfies DomainNightAction))
  );

  for (const playerId of resolution.killedPlayerIds) {
    const player = players.find((candidate) => candidate.id === playerId);
    if (!player) continue;
    await Promise.all([
      context.admin.from("mafia_game_players").update({
        life_status: "dead",
        killed_at_phase: "night_resolution",
        killed_at_round: game.round_number,
        death_reason: "night_kill",
      }).eq("id", player.id),
      context.admin.from("mafia_room_players").update({
        life_status: "dead",
        microphone_enabled: false,
        microphone_blocked: true,
      }).eq("id", player.room_player_id),
    ]);
    player.life_status = "dead";
    await addEvent(context.admin, {
      room_id: room.id,
      game_id: game.id,
      round_number: game.round_number,
      phase: "night_resolution",
      event_type: "player_died",
      visibility: "public",
      target_user_id: null,
      payload: { playerId: player.id, reason: "night_kill" },
    });
  }
  for (const check of resolution.commissionerChecks) {
    const commissioner = players.find((player) => player.id === check.commissionerId);
    if (!commissioner) continue;
    await addEvent(context.admin, {
      room_id: room.id,
      game_id: game.id,
      round_number: game.round_number,
      phase: "night_resolution",
      event_type: "commissioner_result",
      visibility: "private",
      target_user_id: commissioner.user_id,
      payload: { targetGamePlayerId: check.targetId, isMafia: check.isMafia },
    });
  }
  await addEvent(context.admin, {
    room_id: room.id,
    game_id: game.id,
    round_number: game.round_number,
    phase: "night_resolution",
    event_type: "night_resolved",
    visibility: "host",
    target_user_id: null,
    payload: resolution,
  });
  const winner = getWinner(players.map(toDomainPlayer));
  if (winner) {
    await finishGame(context, room, game, winner);
    return true;
  }
  return false;
}

async function resolveVotingOnServer(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  players: GamePlayerRow[]
): Promise<"resolved" | "revote" | "finished"> {
  const { data: voteData, error } = await context.admin.from("mafia_game_votes").select("*").eq("game_id", game.id).eq("round_number", game.round_number);
  if (error) throw new CommandError("Не удалось подсчитать голоса", 500, "vote_resolution_failed");
  const resolution = resolveVotes(
    players.map(toDomainPlayer),
    (voteData ?? []).map((vote) => ({ voterId: vote.voter_game_player_id, targetId: vote.target_game_player_id }))
  );
  if (resolution.eliminatedPlayerId) {
    const eliminated = players.find((player) => player.id === resolution.eliminatedPlayerId);
    if (eliminated) {
      await Promise.all([
        context.admin.from("mafia_game_players").update({
          life_status: "dead",
          killed_at_phase: "day_execution",
          killed_at_round: game.round_number,
          death_reason: "vote",
        }).eq("id", eliminated.id),
        context.admin.from("mafia_room_players").update({
          life_status: "dead",
          microphone_enabled: false,
          microphone_blocked: true,
        }).eq("id", eliminated.room_player_id),
      ]);
      eliminated.life_status = "dead";
    }
  }
  await addEvent(context.admin, {
    room_id: room.id,
    game_id: game.id,
    round_number: game.round_number,
    phase: "day_execution",
    event_type: resolution.eliminatedPlayerId ? "player_executed" : "vote_tied",
    visibility: "public",
    target_user_id: null,
    payload: { ...resolution, revote: !resolution.eliminatedPlayerId && resolution.tiedPlayerIds.length > 1 && room.settings.tieRule === "revote" },
  });
  if (!resolution.eliminatedPlayerId && resolution.tiedPlayerIds.length > 1 && room.settings.tieRule === "revote") {
    const { error: clearVotesError } = await context.admin
      .from("mafia_game_votes")
      .delete()
      .eq("game_id", game.id)
      .eq("round_number", game.round_number);
    if (clearVotesError) throw new CommandError("Не удалось подготовить повторное голосование", 500, "revote_prepare_failed");
    return "revote";
  }
  const winner = getWinner(players.map(toDomainPlayer));
  if (winner) {
    await finishGame(context, room, game, winner);
    return "finished";
  }
  return "resolved";
}

async function finishGame(
  context: CommandContext,
  room: RoomRow,
  game: GameRow,
  winner: "mafia" | "city" | "maniac" | "draw"
) {
  const now = new Date().toISOString();
  await context.admin.from("mafia_games").update({ status: "finished", phase: "game_over", winning_team: winner, ended_at: now }).eq("id", game.id);
  await context.admin.from("mafia_rooms").update({
    status: "finished",
    phase: "game_over",
    phase_version: room.phase_version + 1,
    phase_started_at: now,
    phase_ends_at: null,
  }).eq("id", room.id);
  await addEvent(context.admin, {
    room_id: room.id,
    game_id: game.id,
    round_number: game.round_number,
    phase: "game_over",
    event_type: "game_finished",
    visibility: "public",
    target_user_id: null,
    payload: { winner },
  });
  await addSystemMessage(context.admin, room, game, winner === "mafia" ? "Мафия победила!" : winner === "city" ? "Город победил!" : "Партия завершена.");
}

function validateNightAction(
  phase: GameRow["phase"],
  actor: GamePlayerRow,
  target: GamePlayerRow,
  actionType: NightActionType
) {
  const roleAction = getRoleDefinition(actor.role).nightAction;
  const phaseByAction: Partial<Record<NightActionType, GameRow["phase"]>> = {
    mafia_kill: "night_mafia",
    doctor_heal: "night_doctor",
    commissioner_check: "night_commissioner",
    commissioner_kill: "night_commissioner",
    maniac_kill: "night_mafia",
    mistress_block: "night_mafia",
    bodyguard_protect: "night_doctor",
  };
  if (phaseByAction[actionType] !== phase) throw new CommandError("Это действие недоступно в текущую фазу", 409, "wrong_action_phase");
  if (roleAction !== actionType && !(actor.role === "commissioner" && actionType === "commissioner_kill")) {
    throw new CommandError("Роль не может выполнить это действие", 403, "role_action_forbidden");
  }
  if ((actor.role === "mafia" || actor.role === "don") && target.team === "mafia") {
    throw new CommandError("Мафия не может выбрать союзника");
  }
  if (actor.id === target.id && actionType !== "doctor_heal") throw new CommandError("Нельзя выбрать себя");
}

function toDomainPlayer(player: GamePlayerRow): DomainGamePlayer {
  return {
    id: player.id,
    userId: player.user_id ?? `bot:${player.room_player_id}`,
    role: player.role,
    team: player.team,
    lifeStatus: player.life_status,
    isModerator: player.team === "host",
  };
}

async function buildManualAssignments(
  context: CommandContext,
  activeMembers: RoomPlayerRow[],
  roleCounts: RoleCounts,
  room: RoomRow
) {
  const { data, error } = await context.admin
    .from("mafia_manual_role_assignments")
    .select("room_player_id, role")
    .eq("room_id", room.id);
  if (error) throw new CommandError("Не удалось загрузить ручные роли", 500, "manual_roles_load_failed");
  const manualRoles = Object.fromEntries((data ?? []).map((assignment) => [String(assignment.room_player_id), assignment.role]));
  const expectedDeck = buildRoleDeck(roleCounts, activeMembers.length).sort();
  const selectedRoles = activeMembers.map((member) => manualRoles[member.id]);
  if (selectedRoles.some((role) => typeof role !== "string")) {
    throw new CommandError("Назначьте роль каждому игроку и боту", 409, "manual_roles_incomplete");
  }
  const actualDeck = [...selectedRoles as string[]].sort();
  if (actualDeck.length !== expectedDeck.length || actualDeck.some((role, index) => role !== expectedDeck[index])) {
    throw new CommandError("Ручные роли должны совпадать с количеством ролей в настройках", 409, "manual_roles_mismatch");
  }
  return activeMembers.map((member) => {
    const role = manualRoles[member.id] as Exclude<GamePlayerRow["role"], "host">;
    return { playerId: member.id, role, team: getRoleDefinition(role).team };
  });
}

function phaseAnnouncement(phase: GamePhase): string {
  const labels: Record<GamePhase, string> = {
    lobby: "Комната снова открыта.",
    role_reveal: "Посмотрите свою роль.",
    night_intro: "Город засыпает.",
    night_mafia: "Просыпается мафия.",
    night_doctor: "Просыпается доктор.",
    night_commissioner: "Просыпается комиссар.",
    night_resolution: "Ночь завершена.",
    day_announcement: "Город просыпается.",
    day_discussion: "Началось обсуждение.",
    day_voting: "Началось голосование.",
    day_execution: "Голоса подсчитаны.",
    game_over: "Партия завершена.",
  };
  return labels[phase];
}
