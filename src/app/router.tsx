import React from "react";
import { createHashAppPath, getPathWithoutBase } from "../shared/routing/basePath";
import { useAuth } from "../core/auth/useAuth";
import { routes } from "../core/config/routes";
import { getSessionSnapshot } from "../utils/storage";
import { clearSession } from "../utils/storage";
import { AuthPage } from "../pages/AuthPage";
import { HomePage } from "../pages/HomePage";
import { AppGamesPage } from "../pages/AppGamesPage";
import { AppSettingsPage } from "../pages/AppSettingsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlayerProvider } from "../core/player/PlayerProvider";
import { RoomProvider } from "../core/room/RoomProvider";
import { PrimaryNav } from "../core/layout/PrimaryNav";

const StartPage = React.lazy(() => import("../pages/StartPage").then((module) => ({ default: module.StartPage })));
const GameJoinPage = React.lazy(() => import("../pages/GameJoinPage").then((module) => ({ default: module.GameJoinPage })));
const RoomLobbyPage = React.lazy(() => import("../pages/RoomLobbyPage").then((module) => ({ default: module.RoomLobbyPage })));
const GameHubPage = React.lazy(() => import("../pages/GameHubPage").then((module) => ({ default: module.GameHubPage })));
const ImportPackPage = React.lazy(() => import("../pages/ImportPackPage").then((module) => ({ default: module.ImportPackPage })));
const SettingsPage = React.lazy(() => import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const GameShell = React.lazy(() => import("../core/games/GameShell").then((module) => ({ default: module.GameShell })));
const MafiaJoinPage = React.lazy(() => import("../pages/MafiaJoinPage").then((module) => ({ default: module.MafiaJoinPage })));
const MafiaGameWrapper = React.lazy(() => import("../games/mafia/MafiaGameWrapper").then((module) => ({ default: module.MafiaGameWrapper })));

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
  return <React.Suspense fallback={<RouteLoading />}><RouterContent /></React.Suspense>;
}

function RouterContent() {
  const [route, setRoute] = React.useState<ParsedRoute>(() => parseRoute());
  const { status, profile, signOut } = useAuth();

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

  async function handleLogout() {
    await signOut();
    clearSession();
    navigate(routes.auth);
  }

  if (status === "loading") {
    return (
      <main className="mafia-loading-screen" aria-live="polite">
        <div className="mafia-loading-mark">M</div>
        <p>Подготавливаем город…</p>
      </main>
    );
  }

  const needsProfile = status === "authenticated" && (!profile || profile.displayName === "Игрок");

  if (status !== "authenticated" || needsProfile) {
    return <AuthPage navigate={navigate} />;
  }

  if (route.name === "game-join") {
    if (route.gameId === "mafia") {
      return <MafiaJoinPage roomCode={route.roomCode} navigate={navigate} />;
    }
    return (
      <GameJoinPage
        gameId={route.gameId}
        roomCode={route.roomCode}
        teamId={route.teamId}
      />
    );
  }

  if (route.name === "auth" || route.name === "home") {
    return (
      <>
        <HomePage navigate={navigate} onLogout={() => void handleLogout()} />
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
        <AppSettingsPage onLogout={() => void handleLogout()} />
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

  if (route.name === "game" && route.gameId === "mafia") {
    return <MafiaGameWrapper roomCode={route.roomCode} />;
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

function RouteLoading() {
  return <main className="mafia-loading-screen" aria-live="polite"><div className="mafia-loading-mark">M</div><p>Загружаем сцену…</p></main>;
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
