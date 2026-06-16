import { Room } from "../../pages/Room";
import { clearSession } from "../../utils/storage";
import { routes } from "../../core/config/routes";
import { createHashAppPath } from "../../shared/routing/basePath";

export function MafiaGameWrapper({ roomCode }: { roomCode: string }) {
  return (
    <Room
      roomCode={roomCode}
      onLeave={() => {
        clearSession();
        history.replaceState(null, "", createHashAppPath(routes.gamesHub));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }}
    />
  );
}
