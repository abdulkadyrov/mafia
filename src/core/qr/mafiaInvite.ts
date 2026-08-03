const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function extractMafiaRoomCode(value: string): string | null {
  const direct = normalizeCode(value);
  if (ROOM_CODE_PATTERN.test(direct) && value.trim().length === 6) return direct;

  try {
    const url = new URL(value.trim(), "https://mafia.local");
    const directQueryCode = normalizeCode(url.searchParams.get("roomCode") ?? "");
    if (/^\/game\/mafia\/join\/?$/.test(url.pathname) && ROOM_CODE_PATTERN.test(directQueryCode)) return directQueryCode;

    const hashPath = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const hashUrl = new URL(hashPath || "/", "https://mafia.local");
    if (!/^\/game\/mafia\/join\/?$/.test(hashUrl.pathname)) return null;
    const hashCode = normalizeCode(hashUrl.searchParams.get("roomCode") ?? "");
    return ROOM_CODE_PATTERN.test(hashCode) ? hashCode : null;
  } catch {
    return null;
  }
}

function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
