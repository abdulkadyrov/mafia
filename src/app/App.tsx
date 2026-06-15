import React from "react";
import { Lobby } from "../pages/Lobby";
import { Room } from "../pages/Room";
import {
  createAppPath,
  createHashAppPath,
  getPathWithoutBase,
} from "../shared/routing/basePath";

type RouteState =
  | {
      name: "lobby";
    }
  | {
      name: "room";
      roomCode: string;
    };

const ROOM_CODE_STORAGE_KEY = "mafia_room_code";

export const App: React.FC = () => {
  const [route, setRoute] = React.useState<RouteState>(() => {
    const parsedRoute = getBrowserRoute();
    const pathMatch = parsedRoute.path.match(/\/room\/([^/?]+)/);

    if (pathMatch) {
      return {
        name: "room",
        roomCode: pathMatch[1],
      };
    }

    const storedRoomCode = window.localStorage.getItem(ROOM_CODE_STORAGE_KEY);

    if (storedRoomCode) {
      return {
        name: "room",
        roomCode: storedRoomCode,
      };
    }

    return {
      name: "lobby",
    };
  });

  return (
    <div className="min-h-screen bg-background text-text">
      {route.name === "lobby" ? (
        <Lobby
          onOpenRoom={(roomCode) => {
            history.replaceState(
              null,
              "",
              createHashAppPath(`/room/${roomCode}`)
            );
            setRoute({
              name: "room",
              roomCode,
            });
          }}
        />
      ) : (
        <Room
          roomCode={route.roomCode}
          onLeave={() => {
            window.localStorage.removeItem("mafia_room_id");
            window.localStorage.removeItem("mafia_player_id");
            window.localStorage.removeItem("mafia_room_code");
            history.replaceState(null, "", createAppPath("/"));
            setRoute({ name: "lobby" });
          }}
        />
      )}
    </div>
  );
};

function getBrowserRoute(): { path: string; search: string } {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";

  if (hash) {
    const [path, search = ""] = hash.split("?");

    return {
      path,
      search,
    };
  }

  return {
    path: getPathWithoutBase(location.pathname),
    search: location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search,
  };
}
