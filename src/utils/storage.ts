export const STORAGE_KEYS = {
  roomId: "mafia_room_id",
  roomCode: "mafia_room_code",
  playerId: "mafia_player_id",
  playerName: "mafia-player-name",
} as const;

export type SessionSnapshot = {
  roomId: string | null;
  roomCode: string | null;
  playerId: string | null;
  playerName: string | null;
};

export function getSessionSnapshot(): SessionSnapshot {
  return {
    roomId: window.localStorage.getItem(STORAGE_KEYS.roomId),
    roomCode: window.localStorage.getItem(STORAGE_KEYS.roomCode),
    playerId: window.localStorage.getItem(STORAGE_KEYS.playerId),
    playerName: window.localStorage.getItem(STORAGE_KEYS.playerName),
  };
}

export function persistSession(input: {
  roomId: string;
  roomCode: string;
  playerId: string;
  playerName: string;
}) {
  window.localStorage.setItem(STORAGE_KEYS.roomId, input.roomId);
  window.localStorage.setItem(STORAGE_KEYS.roomCode, input.roomCode);
  window.localStorage.setItem(STORAGE_KEYS.playerId, input.playerId);
  window.localStorage.setItem(STORAGE_KEYS.playerName, input.playerName);
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEYS.roomId);
  window.localStorage.removeItem(STORAGE_KEYS.roomCode);
  window.localStorage.removeItem(STORAGE_KEYS.playerId);
  window.localStorage.removeItem(STORAGE_KEYS.playerName);
}

