import { ClientAction, GameSnapshot } from "../types/game";

type RelayAction = {
  id: number;
  peerId: string;
  payload: ClientAction;
};

export function isLanRelayMode(): boolean {
  return import.meta.env.PROD && location.protocol === "http:";
}

export class LanRelayHostNetwork {
  private pollingId: number | undefined;
  private lastActionVersion = 0;

  constructor(
    public roomCode: string,
    private getSnapshot: () => GameSnapshot,
    private onClientAction: (peerId: string, action: ClientAction) => void
  ) {}

  async start(): Promise<string> {
    await postJson("/api/room/start", { roomCode: this.roomCode });
    await this.broadcastSnapshot();

    this.pollingId = window.setInterval(() => {
      this.pollActions().catch(() => undefined);
    }, 700);

    return `lan-${this.roomCode}`;
  }

  async broadcastSnapshot() {
    await postJson("/api/room/snapshot", {
      roomCode: this.roomCode,
      snapshot: this.getSnapshot(),
    });
  }

  stop() {
    if (this.pollingId) {
      window.clearInterval(this.pollingId);
    }
  }

  private async pollActions() {
    const result = await getJson<{ actions: RelayAction[]; version: number }>(
      `/api/room/actions?roomCode=${encodeURIComponent(this.roomCode)}&after=${
        this.lastActionVersion
      }`
    );

    for (const action of result.actions) {
      this.lastActionVersion = Math.max(this.lastActionVersion, action.id);
      this.onClientAction(action.peerId, action.payload);
    }
  }
}

export class LanRelayClientNetwork {
  private pollingId: number | undefined;
  private peerId = `lan-client-${Math.random().toString(36).slice(2)}`;
  private snapshotVersion = 0;
  private roomCode = "";

  constructor(
    private onSnapshot?: (snapshot: GameSnapshot) => void,
    private onConnectionError?: (message: string) => void
  ) {}

  async join(roomCode: string) {
    this.roomCode = roomCode;

    await getJson<{ ok: boolean }>("/api/health");

    const status = await getJson<{ exists: boolean }>(
      `/api/room/status?roomCode=${encodeURIComponent(roomCode)}`
    );

    if (!status.exists) {
      throw new Error(
        "Комната не найдена. Откройте комнату на хосте, затем введите тот же код на телефоне."
      );
    }

    await this.pollSnapshot();

    this.pollingId = window.setInterval(() => {
      this.pollSnapshot().catch((error) => {
        this.onConnectionError?.(
          error instanceof Error
            ? error.message
            : "Потеряно соединение с LAN-сервером"
        );
      });
    }, 700);
  }

  async sendAction(action: ClientAction) {
    await postJson("/api/room/action", {
      roomCode: this.roomCode,
      peerId: this.peerId,
      action,
    });
  }

  destroy() {
    if (this.pollingId) {
      window.clearInterval(this.pollingId);
    }
  }

  private async pollSnapshot() {
    const result = await getJson<{
      snapshot: GameSnapshot | null;
      version: number;
    }>(`/api/room/snapshot?roomCode=${encodeURIComponent(this.roomCode)}`);

    if (result.snapshot && result.version !== this.snapshotVersion) {
      this.snapshotVersion = result.version;
      this.onSnapshot?.(result.snapshot);
    }
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`LAN server error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LAN server error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "LAN-сервер не ответил за 5 секунд. Проверьте Wi-Fi, VPN, точку доступа и firewall на устройстве хоста."
      );
    }

    throw new Error(
      "LAN-сервер недоступен. Откройте адрес вида http://IP:4173/mafia/ с устройства хоста и отключите VPN."
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}
