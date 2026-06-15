import { GameSnapshot } from "../../types/game";

const databaseName = "mafia-lan-pwa";
const storeName = "game-archives";
const databaseVersion = 1;

export type ArchivedGame = {
  id: string;
  roomCode: string;
  savedAt: number;
  snapshot: GameSnapshot;
};

export async function saveArchivedGame(snapshot: GameSnapshot): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);

  store.put({
    id: snapshot.roomCode,
    roomCode: snapshot.roomCode,
    savedAt: Date.now(),
    snapshot,
  } satisfies ArchivedGame);

  await waitForTransaction(transaction);
  database.close();
}

export async function getArchivedGames(): Promise<ArchivedGame[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const request = store.getAll();
  const games = await waitForRequest<ArchivedGame[]>(request);

  database.close();

  return games.sort((first, second) => second.savedAt - first.savedAt);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
