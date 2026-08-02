import type { GamePhase, PlayerLifeStatus } from "../game/gameTypes";
import type { MafiaTeam } from "../roles/roleTypes";

export type AudioPermissionInput = {
  phase: GamePhase;
  lifeStatus: PlayerLifeStatus;
  team: MafiaTeam;
  isHost: boolean;
  hostMuted: boolean;
};

export function canPublishAudio(input: AudioPermissionInput): boolean {
  if (input.hostMuted || input.lifeStatus !== "alive") return input.isHost && !input.hostMuted;
  if (input.isHost) return true;
  if (input.phase === "night_mafia") return input.team === "mafia";
  if (input.phase.startsWith("night_")) return false;
  return input.phase === "lobby" || input.phase.startsWith("day_") || input.phase === "role_reveal";
}

export function enforceAudioPermission(stream: MediaStream | null, allowed: boolean): void {
  for (const track of stream?.getAudioTracks() ?? []) {
    track.enabled = allowed;
  }
}
