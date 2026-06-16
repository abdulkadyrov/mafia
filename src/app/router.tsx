import React from "react";
import { createHashAppPath, getPathWithoutBase } from "../shared/routing/basePath";
import { routes } from "../core/config/routes";
import { getSessionSnapshot } from "../utils/storage";
import { StartPage } from "../pages/StartPage";
import { RoomLobbyPage } from "../pages/RoomLobbyPage";
import { GameHubPage } from "../pages/GameHubPage";
import { ImportPackPage } from "../pages/ImportPackPage";
import { SettingsPage } from "../pages/SettingsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { GameShell } from "../core/games/GameShell";
import { PlayerProvider } from "../core/player/PlayerProvider";
import { RoomProvider } from "../core/room/RoomProvider";

type ParsedRoute =
  | { name: "home" }
  | { name: "room"; roomCode: string }
  | { name: "games"; roomCode: string }
  | { name: "game"; roomCode: string; gameId: string }
  | { name: "import"; roomCode: string }
  | { name: "settings"; roomCode: string }
  | { name: "not-found" };

export function Router() {
  const [route, setRoute] = React.useState<ParsedRoute>(() => parseRoute());

  React.useEffect(() => {
    const handleChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", handleChange);
    window.addEventListener("popstate", handleChange);

    return () => {
      window.removeEventListener("hashchange", handleChange);
      window.removeEventListener("popstate", handleChange);
    };
  }, []);

  function navigate(path: string) {
    history.replaceState(null, "", createHashAppPath(path));
    setRoute(parseRoute());
  }

  if (route.name === "home") {
    return <StartPage navigate={navigate} />;
  }

  if (route.name === "not-found") {
    return <NotFoundPage onHome={() => navigate(routes.home)} />;
  }

  if (!hasActiveSession(route.roomCode)) {
    navigate(routes.home);
    return null;
  }

  return (
    <RoomProvider roomCode={route.roomCode}>
      <PlayerProvider>
        {route.name === "room" ? (
          <RoomLobbyPage roomCode={route.roomCode} navigate={navigate} />
        ) : route.name === "games" ? (
          <GameHubPage roomCode={route.roomCode} navigate={navigate} />
        ) : route.name === "import" ? (
          <ImportPackPage />
        ) : route.name === "settings" ? (
          <SettingsPage />
        ) : (
          <GameShell roomCode={route.roomCode} gameId={route.gameId} />
        )}
      </PlayerProvider>
    </RoomProvider>
  );
}

function hasActiveSession(roomCode: string) {
  const session = getSessionSnapshot();

  return Boolean(
    session.playerName &&
      session.playerId &&
      session.roomCode &&
      session.roomCode === roomCode
  );
}

function parseRoute(): ParsedRoute {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  const path = hash || getPathWithoutBase(location.pathname);
  const roomMatch = path.match(/^\/room\/([^/]+)$/);
  const gamesMatch = path.match(/^\/room\/([^/]+)\/games$/);
  const gameMatch = path.match(/^\/room\/([^/]+)\/game\/([^/]+)$/);
  const importMatch = path.match(/^\/room\/([^/]+)\/import$/);
  const settingsMatch = path.match(/^\/room\/([^/]+)\/settings$/);

  if (path === "/" || path === "") {
    return { name: "home" };
  }

  if (roomMatch) {
    return { name: "room", roomCode: roomMatch[1] };
  }

  if (gamesMatch) {
    return { name: "games", roomCode: gamesMatch[1] };
  }

  if (gameMatch) {
    return { name: "game", roomCode: gameMatch[1], gameId: gameMatch[2] };
  }

  if (importMatch) {
    return { name: "import", roomCode: importMatch[1] };
  }

  if (settingsMatch) {
    return { name: "settings", roomCode: settingsMatch[1] };
  }

  return { name: "not-found" };
}

