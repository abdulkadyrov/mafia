import React from "react";
import { useRoom } from "../room/useRoom";
import { getTeams } from "./teamService";
import type { Team } from "./teamTypes";

export function useTeams() {
  const { room } = useRoom();
  const [teams, setTeams] = React.useState<Team[]>([]);

  React.useEffect(() => {
    if (!room?.id) {
      setTeams([]);
      return;
    }

    void getTeams(room.id)
      .then(setTeams)
      .catch(() => setTeams([]));
  }, [room?.id]);

  return teams;
}

