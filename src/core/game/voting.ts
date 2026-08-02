import type { DomainGamePlayer } from "./gameTypes.ts";

export type DomainVote = { voterId: string; targetId: string };
export type VoteResolution = {
  eliminatedPlayerId: string | null;
  tiedPlayerIds: string[];
  counts: Record<string, number>;
};

export function resolveVotes(
  players: readonly DomainGamePlayer[],
  votes: readonly DomainVote[]
): VoteResolution {
  const aliveIds = new Set(players.filter((player) => player.lifeStatus === "alive" && !player.isHost).map((player) => player.id));
  const uniqueVoters = new Set<string>();
  const counts: Record<string, number> = {};

  for (const vote of votes) {
    if (!aliveIds.has(vote.voterId) || !aliveIds.has(vote.targetId) || uniqueVoters.has(vote.voterId)) continue;
    uniqueVoters.add(vote.voterId);
    counts[vote.targetId] = (counts[vote.targetId] ?? 0) + 1;
  }

  const highest = Math.max(0, ...Object.values(counts));
  const leaders = Object.entries(counts).filter(([, count]) => count === highest).map(([id]) => id);
  const tiedPlayerIds = leaders.length > 1 ? leaders : [];
  return {
    eliminatedPlayerId: leaders.length === 1 ? leaders[0] : null,
    tiedPlayerIds,
    counts,
  };
}
