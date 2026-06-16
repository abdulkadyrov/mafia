import type { SupportedPackGame } from "./packTypes";
import { safeJsonParse } from "../../utils/json";

const LOCAL_PACK_LIBRARY_STORAGE_KEY = "ag_local_pack_library";

export type LocalGamePackRecord = {
  id: string;
  gameType: SupportedPackGame;
  title: string;
  content: unknown;
  updatedAt: string;
};

export function getLocalPackLibrary(): LocalGamePackRecord[] {
  const rawValue = window.localStorage.getItem(LOCAL_PACK_LIBRARY_STORAGE_KEY);
  const parsed = rawValue
    ? safeJsonParse<LocalGamePackRecord[]>(rawValue)
    : null;

  return Array.isArray(parsed) ? parsed : [];
}

export function getLocalGamePacksByType(gameType: SupportedPackGame) {
  return getLocalPackLibrary()
    .filter((pack) => pack.gameType === gameType)
    .sort(
      (left, right) =>
        new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
    );
}

export function saveLocalGamePack(input: {
  id?: string;
  gameType: SupportedPackGame;
  title: string;
  content: unknown;
}) {
  const currentLibrary = getLocalPackLibrary();
  const packId =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const nextPack: LocalGamePackRecord = {
    id: packId,
    gameType: input.gameType,
    title: input.title,
    content: input.content,
    updatedAt: new Date().toISOString(),
  };

  const nextLibrary = currentLibrary.some((pack) => pack.id === packId)
    ? currentLibrary.map((pack) => (pack.id === packId ? nextPack : pack))
    : [...currentLibrary, nextPack];

  window.localStorage.setItem(
    LOCAL_PACK_LIBRARY_STORAGE_KEY,
    JSON.stringify(nextLibrary)
  );

  return nextPack;
}

export function removeLocalGamePack(packId: string) {
  const nextLibrary = getLocalPackLibrary().filter((pack) => pack.id !== packId);
  window.localStorage.setItem(
    LOCAL_PACK_LIBRARY_STORAGE_KEY,
    JSON.stringify(nextLibrary)
  );
}
