import React from "react";
import { useRoom } from "../room/useRoom";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { useTeams } from "./useTeams";

const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];

export function TeamManager() {
  const { players } = useRoom();
  const {
    teams,
    members,
    createTeam,
    assignPlayerToTeam,
    removePlayerFromTeam,
  } = useTeams();
  const [teamName, setTeamName] = React.useState("");

  function getPlayerTeamId(playerId: string) {
    return members.find((member) => member.player_id === playerId)?.team_id ?? null;
  }

  return (
    <Card>
      <h3 className="text-xl font-black text-white">Команды</h3>
      <div className="mt-4 flex gap-2">
        <Input
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="Название команды"
        />
        <Button
          onClick={() => {
            const nextName = teamName.trim();

            if (!nextName) {
              return;
            }

            void createTeam({
              name: nextName,
              color: TEAM_COLORS[teams.length % TEAM_COLORS.length],
            });
            setTeamName("");
          }}
        >
          Добавить
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: team.color ?? "#ffffff" }}
                />
                <p className="font-black text-white">{team.name}</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-white/60">
                Игроков: {members.filter((member) => member.team_id === team.id).length}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {players.map((player) => {
            const currentTeamId = getPlayerTeamId(player.id);

            return (
              <div
                key={player.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{player.name}</p>
                    <p className="mt-1 text-xs font-semibold text-white/50">
                      {currentTeamId
                        ? teams.find((team) => team.id === currentTeamId)?.name ??
                          "Команда"
                        : "Без команды"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          void assignPlayerToTeam({
                            teamId: team.id,
                            playerId: player.id,
                          });
                        }}
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-black transition",
                          currentTeamId === team.id
                            ? "border-white bg-white text-zinc-950"
                            : "border-white/10 bg-transparent text-white/75 hover:bg-white/8",
                        ].join(" ")}
                      >
                        {team.name}
                      </button>
                    ))}
                    {currentTeamId ? (
                      <button
                        type="button"
                        onClick={() => {
                          void removePlayerFromTeam(player.id);
                        }}
                        className="rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-100"
                      >
                        Снять
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
