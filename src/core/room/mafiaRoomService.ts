import { invokeMafiaCommand } from "../game/gameCommands";
import type { MafiaRoomRecord, MafiaRoomSettings, MafiaSnapshot } from "./mafiaRoomTypes";

const ACTIVE_ROOM_KEY = "mafia-active-rooms";

export function normalizeMafiaRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export async function createMafiaRoom(settings: MafiaRoomSettings): Promise<MafiaSnapshot> {
  const snapshot = await invokeMafiaCommand<MafiaSnapshot>({ type: "create_room", settings });
  rememberRoom(snapshot.room);
  return snapshot;
}

export async function joinMafiaRoom(code: string): Promise<MafiaSnapshot> {
  const cleanCode = normalizeMafiaRoomCode(code);
  if (cleanCode.length !== 6) throw new Error("Введите шестизначный код комнаты");
  const snapshot = await invokeMafiaCommand<MafiaSnapshot>({ type: "join_room", code: cleanCode });
  rememberRoom(snapshot.room);
  return snapshot;
}

export async function getRecentMafiaRooms(): Promise<MafiaRoomRecord[]> {
  return invokeMafiaCommand<MafiaRoomRecord[]>({ type: "my_rooms" });
}

export function getRememberedRoomId(code: string): string | null {
  try {
    const map = JSON.parse(window.localStorage.getItem(ACTIVE_ROOM_KEY) ?? "{}") as Record<string, string>;
    return map[normalizeMafiaRoomCode(code)] ?? null;
  } catch {
    return null;
  }
}

export function forgetMafiaRoom(code: string): void {
  const cleanCode = normalizeMafiaRoomCode(code);
  try {
    const map = JSON.parse(window.localStorage.getItem(ACTIVE_ROOM_KEY) ?? "{}") as Record<string, string>;
    delete map[cleanCode];
    window.localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(map));
  } catch {
    window.localStorage.removeItem(ACTIVE_ROOM_KEY);
  }
}

function rememberRoom(room: MafiaRoomRecord): void {
  let map: Record<string, string> = {};
  try {
    map = JSON.parse(window.localStorage.getItem(ACTIVE_ROOM_KEY) ?? "{}") as Record<string, string>;
  } catch { /* повреждённое локальное значение заменяется пустой картой */ }
  map[room.code] = room.id;
  window.localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(map));
}
