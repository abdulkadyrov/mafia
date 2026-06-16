import { Card } from "../ui/Card";
import type { Team } from "../teams/teamTypes";

export function ScoreBoard({ teams }: { teams: Team[] }) {
  return (
    <Card>
      <h3 className="text-xl font-black text-white">Счёт команд</h3>
      <div className="mt-4 space-y-3">
        {teams.length === 0 ? (
          <p className="text-sm font-semibold text-white/65">
            Команды пока не созданы.
          </p>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="font-black text-white">{team.name}</p>
              <p className="text-lg font-black text-emerald-200">{team.score}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

