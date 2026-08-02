import { createHashAppPath } from "../../shared/routing/basePath";
import { routes } from "../../core/config/routes";
import { MafiaRoomProvider } from "../../core/room/MafiaRoomProvider";
import { MafiaGame } from "./MafiaGame";

export function MafiaGameWrapper({ roomCode }: { roomCode: string }) {
  function navigateHome() {
    history.replaceState(null, "", createHashAppPath(routes.home));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  function navigateNewRoom() {
    history.replaceState(null, "", createHashAppPath(routes.launch("mafia")));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  return (
    <MafiaRoomProvider roomCode={roomCode}>
      <MafiaGame onHome={navigateHome} onNewRoom={navigateNewRoom} />
    </MafiaRoomProvider>
  );
}
