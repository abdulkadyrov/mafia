import type { MafiaPlayerView } from "./mafiaRoomTypes";

export function orderPlayersSelfFirst(players: MafiaPlayerView[], selfUserId: string) {
  const self = players.find((player) => player.user_id === selfUserId);
  if (!self || players[0]?.id === self.id) return players;
  return [self, ...players.filter((player) => player.id !== self.id)];
}
