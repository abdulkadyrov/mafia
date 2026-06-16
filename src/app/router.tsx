import React from "react";
import { createHashAppPath, getPathWithoutBase } from "../shared/routing/basePath";
import { isAuthenticated, logout } from "../core/auth/authStorage";
import { routes } from "../core/config/routes";
import { getSessionSnapshot } from "../utils/storage";
import { clearSession } from "../utils/storage";
import { AuthPage } from "../pages/AuthPage";
import { HomePage } from "../pages/HomePage";
import { AppGamesPage } from "../pages/AppGamesPage";
import { AppSettingsPage } from "../pages/AppSettingsPage";
import { StartPage } from "../pages/StartPage";
import { GameJoinPage } from "../pages/GameJoinPage";
import { RoomLobbyPage } from "../pages/RoomLobbyPage";
import { GameHubPage } from "../pages/GameHubPage";
import { ImportPackPage } from "../pages/ImportPackPage";
import { SettingsPage } from "../pages/SettingsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { GameShell } from "../core/games/GameShell";
import { PlayerProvider } from "../core/player/PlayerProvider";
import { RoomProvider } from "../core/room/RoomProvider";
import { PrimaryNav } from "../core/layout/PrimaryNav";

type ParsedRoute =
  | { name: "auth" }
  | { name: "home" }
  | { name: "games-hub" }
  | { name: "settings-hub" }
  | { name: "launch"; gameId?: string }
  | { name: "game-join"; gameId: string; roomCode: string; teamId?: string }
  | { name: "room"; roomCode: string }
  | { name: "games"; roomCode: string }
  | { name: "game"; roomCode: string; gameId: string }
  | { name: "import"; roomCode: string }
  | { name: "settings"; roomCode: string }
  | { name: "not-found" };

export function Router() {
  const [route, setRoute] = React.useState<ParsedRoute>(() => parseRoute());
  const [authed, setAuthed] = React.useState(() => isAuthenticated());

  React.useEffect(() => {
    const handleChange = () => setRoute(parseRoute());
    const handleStorage = () => setAuthed(isAuthenticated());
    window.addEventListener("hashchange", handleChange);
    window.addEventListener("popstate", handleChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("hashchange", handleChange);
      window.removeEventListener("popstate", handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function navigate(path: string) {
    history.replaceState(null, "", createHashAppPath(path));
    setRoute(parseRoute());
  }

  function handleLogout() {
    logout();
    clearSession();
    setAuthed(false);
    navigate(routes.auth);
  }

  if (route.name === "game-join") {
    return (
      <GameJoinPage
        gameId={route.gameId}
        roomCode={route.roomCode}
        teamId={route.teamId}
      />
    );
  }

  if (!authed) {
    return (
      <AuthPage
        navigate={navigate}
        onSuccess={() => {
          setAuthed(true);
        }}
      />
    );
  }

  if (route.name === "auth" || route.name === "home") {
    return (
      <>
        <HomePage navigate={navigate} onLogout={handleLogout} />
        <PrimaryNav currentPath={routes.home} onNavigate={navigate} />
      </>
    );
  }

  if (route.name === "games-hub") {
    return (
      <>
        <AppGamesPage navigate={navigate} />
        <PrimaryNav currentPath={routes.gamesHub} onNavigate={navigate} />
      </>
    );
  }

  if (route.name === "settings-hub") {
    return (
      <>
        <AppSettingsPage onLogout={handleLogout} />
        <PrimaryNav currentPath={routes.settingsHub} onNavigate={navigate} />
      </>
    );
  }

  if (route.name === "launch") {
    return <StartPage navigate={navigate} targetGameId={route.gameId} />;
  }

  if (route.name === "not-found") {
    return <NotFoundPage onHome={() => navigate(routes.home)} />;
  }

  if (!hasActiveSession(route.roomCode)) {
    navigate(routes.launch());
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
  const fullPath = hash || getPathWithoutBase(location.pathname);
  const [path, queryString = ""] = fullPath.split("?");
  const search = new URLSearchParams(queryString);
  const launchMatch = path.match(/^\/launch(?:\/([^/]+))?$/);
  const gameJoinMatch = path.match(/^\/game\/([^/]+)\/join$/);
  const roomMatch = path.match(/^\/room\/([^/]+)$/);
  const gamesMatch = path.match(/^\/room\/([^/]+)\/games$/);
  const gameMatch = path.match(/^\/room\/([^/]+)\/game\/([^/]+)$/);
  const importMatch = path.match(/^\/room\/([^/]+)\/import$/);
  const settingsMatch = path.match(/^\/room\/([^/]+)\/settings$/);

  if (path === "/" || path === "") {
    return { name: "auth" };
  }

  if (path === routes.home) {
    return { name: "home" };
  }

  if (path === routes.gamesHub) {
    return { name: "games-hub" };
  }

  if (path === routes.settingsHub) {
    return { name: "settings-hub" };
  }

  if (launchMatch) {
    return { name: "launch", gameId: launchMatch[1] };
  }

  if (gameJoinMatch) {
    return {
      name: "game-join",
      gameId: gameJoinMatch[1],
      roomCode: search.get("roomCode") ?? "",
      teamId: search.get("teamId") ?? undefined,
    };
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
