import type { DomainGamePlayer, DomainNightAction } from "./gameTypes.ts";

export type NightResolution = {
  killedPlayerIds: string[];
  savedPlayerIds: string[];
  blockedPlayerIds: string[];
  commissionerChecks: Array<{ commissionerId: string; targetId: string; isMafia: boolean }>;
};

export function resolveNight(
  players: readonly DomainGamePlayer[],
  actions: readonly DomainNightAction[]
): NightResolution {
  const aliveIds = new Set(players.filter((player) => player.lifeStatus === "alive" && !player.isHost).map((player) => player.id));
  const blocked = new Set(
    actions.filter((action) => action.type === "mistress_block" && aliveIds.has(action.targetId)).map((action) => action.targetId)
  );
  const usable = actions.filter(
    (action) => aliveIds.has(action.actorId) && aliveIds.has(action.targetId) && !blocked.has(action.actorId)
  );
  const protectedIds = new Set(
    usable
      .filter((action) => action.type === "doctor_heal" || action.type === "bodyguard_protect")
      .map((action) => action.targetId)
  );

  const mafiaVotes = usable.filter((action) => action.type === "mafia_kill");
  const mafiaTarget = getMajorityTarget(mafiaVotes.map((action) => action.targetId));
  const attacks = [
    ...(mafiaTarget ? [mafiaTarget] : []),
    ...usable
      .filter((action) => action.type === "maniac_kill" || action.type === "commissioner_kill")
      .map((action) => action.targetId),
  ];
  const killedPlayerIds = [...new Set(attacks.filter((targetId) => !protectedIds.has(targetId)))];
  const savedPlayerIds = [...new Set(attacks.filter((targetId) => protectedIds.has(targetId)))];
  const byId = new Map(players.map((player) => [player.id, player]));

  return {
    killedPlayerIds,
    savedPlayerIds,
    blockedPlayerIds: [...blocked],
    commissionerChecks: usable
      .filter((action) => action.type === "commissioner_check")
      .map((action) => ({
        commissionerId: action.actorId,
        targetId: action.targetId,
        isMafia: byId.get(action.targetId)?.team === "mafia",
      })),
  };
}

function getMajorityTarget(targetIds: readonly string[]): string | null {
  const counts = targetIds.reduce<Record<string, number>>((result, targetId) => {
    result[targetId] = (result[targetId] ?? 0) + 1;
    return result;
  }, {});
  const ordered = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  if (!ordered[0] || ordered[0][1] === ordered[1]?.[1]) return null;
  return ordered[0][0];
}
