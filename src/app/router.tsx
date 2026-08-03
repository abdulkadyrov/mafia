import React from "react";
import { createHashAppPath, getPathWithoutBase } from "../shared/routing/basePath";
import { useAuth } from "../core/auth/useAuth";
import { routes } from "../core/config/routes";
import { clearSession } from "../utils/storage";
import { AuthPage } from "../pages/AuthPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";

const StartPage = React.lazy(() => import("../pages/StartPage").then((module) => ({ default: module.StartPage })));
const MafiaJoinPage = React.lazy(() => import("../pages/MafiaJoinPage").then((module) => ({ default: module.MafiaJoinPage })));
const MafiaGameWrapper = React.lazy(() => import("../games/mafia/MafiaGameWrapper").then((module) => ({ default: module.MafiaGameWrapper })));

type ParsedRoute =
  | { name: "auth" }
  | { name: "home" }
  | { name: "games-hub" }
  | { name: "settings-hub" }
  | { name: "launch"; gameId?: string }
  | { name: "game-join"; gameId: string; roomCode: string; teamId?: string }
  | { name: "game"; roomCode: string; gameId: string }
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
    return <NotFoundPage onHome={() => navigate(routes.home)} />;
  }

  if (route.name === "auth" || route.name === "home" || route.name === "games-hub" || route.name === "settings-hub") {
    return <HomePage navigate={navigate} onLogout={() => void handleLogout()} />;
  }

  if (route.name === "launch") {
    return route.gameId && route.gameId !== "mafia"
      ? <NotFoundPage onHome={() => navigate(routes.home)} />
      : <StartPage navigate={navigate} targetGameId="mafia" />;
  }

  if (route.name === "not-found") {
    return <NotFoundPage onHome={() => navigate(routes.home)} />;
  }

  if (route.name === "game" && route.gameId === "mafia") {
    return <MafiaGameWrapper roomCode={route.roomCode} />;
  }

  return <NotFoundPage onHome={() => navigate(routes.home)} />;
}

function RouteLoading() {
  return <main className="mafia-loading-screen" aria-live="polite"><div className="mafia-loading-mark">M</div><p>Загружаем сцену…</p></main>;
}

function parseRoute(): ParsedRoute {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  const fullPath = hash || getPathWithoutBase(location.pathname);
  const [path, queryString = ""] = fullPath.split("?");
  const search = new URLSearchParams(queryString);
  const launchMatch = path.match(/^\/launch(?:\/([^/]+))?$/);
  const gameJoinMatch = path.match(/^\/game\/([^/]+)\/join$/);
  const gameMatch = path.match(/^\/room\/([^/]+)\/game\/([^/]+)$/);

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

  if (gameMatch) {
    return { name: "game", roomCode: gameMatch[1], gameId: gameMatch[2] };
  }

  return { name: "not-found" };
}
