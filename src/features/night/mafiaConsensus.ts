import type { MafiaEvent } from "../../core/room/mafiaRoomTypes";

export type MafiaChoice = {
  eventId: MafiaEvent["id"];
  actorId: string;
  targetId: string;
};

export function getLatestMafiaChoices(events: MafiaEvent[], roundNumber: number, gameId: string | null): MafiaChoice[] {
  const latestByActor = new Map<string, MafiaChoice>();
  for (const event of events) {
    const actorId = event.payload.actorId;
    const targetId = event.payload.targetId;
    if (
      event.round_number !== roundNumber
      || event.game_id !== gameId
      || event.phase !== "night_mafia"
      || event.event_type !== "night_action_submitted"
      || event.payload.actionType !== "mafia_kill"
      || typeof actorId !== "string"
      || typeof targetId !== "string"
    ) continue;
    latestByActor.set(actorId, { eventId: event.id, actorId, targetId });
  }
  return [...latestByActor.values()];
}
