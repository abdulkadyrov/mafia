import { Room } from "../../pages/Room";
import { routes } from "../../core/config/routes";
import { createHashAppPath } from "../../shared/routing/basePath";

export function MafiaGameWrapper({ roomCode }: { roomCode: string }) {
  return (
    <Room
      roomCode={roomCode}
      onLeave={() => {
        history.replaceState(null, "", createHashAppPath(routes.room(roomCode)));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }}
    />
  );
}
