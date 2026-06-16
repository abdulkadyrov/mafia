import React from "react";
import { useRoom } from "../room/useRoom";
import {
  subscribeToTeamMembers,
  subscribeToTeams,
  unsubscribe,
} from "../supabase/realtime";
import {
  assignPlayerToTeam,
  createTeam,
  getTeamMembers,
  getTeams,
  removePlayerFromTeam,
  type TeamMember,
} from "./teamService";
import type { Team } from "./teamTypes";
import { setIfChanged } from "../../utils/state";

export function useTeams() {
  const { room } = useRoom();
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!room?.id) {
      setIfChanged(setTeams, []);
      setIfChanged(setMembers, []);
      setIsLoading(false);
      return;
    }

    const [nextTeams, nextMembers] = await Promise.all([
      getTeams(room.id),
      getTeamMembers(room.id),
    ]);
    setIfChanged(setTeams, nextTeams);
    setIfChanged(setMembers, nextMembers);
    setIsLoading(false);
  }, [room?.id]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!room?.id) {
      return undefined;
    }

    const teamsChannel = subscribeToTeams(room.id, () => {
      void refresh();
    });
    const membersChannel = subscribeToTeamMembers(() => {
      void refresh();
    });

    return () => {
      unsubscribe(teamsChannel);
      unsubscribe(membersChannel);
    };
  }, [refresh, room?.id]);

  return {
    teams,
    members,
    isLoading,
    refresh,
    createTeam: async (input: { name: string; color?: string | null }) => {
      if (!room?.id) {
        return;
      }

      await createTeam({
        roomId: room.id,
        name: input.name,
        color: input.color,
      });
      await refresh();
    },
    assignPlayerToTeam: async (input: { teamId: string; playerId: string }) => {
      await assignPlayerToTeam(input);
      await refresh();
    },
    removePlayerFromTeam: async (playerId: string) => {
      await removePlayerFromTeam(playerId);
      await refresh();
    },
  };
}
