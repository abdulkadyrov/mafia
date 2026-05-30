import { Panel } from "../shared/ui/Panel";
import { GameSnapshot, PlayerId } from "../types/game";

type SystemFeedProps = {
  snapshot: GameSnapshot;
  selfPlayerId?: PlayerId;
};

export function SystemFeed({ snapshot, selfPlayerId }: SystemFeedProps) {
  const visibleHistory = snapshot.history.filter((entry) => {
    return !entry.privateFor || entry.privateFor === selfPlayerId;
  });

  return (
    <Panel>
      <h2 className="mb-4 text-lg font-black text-zinc-950">Журнал событий</h2>
      <div className="max-h-80 space-y-3 overflow-auto pr-1">
        {visibleHistory.length === 0 ? (
          <p className="text-sm font-semibold text-zinc-500">
            События появятся после старта игры.
          </p>
        ) : (
          visibleHistory
            .slice()
            .reverse()
            .map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-zinc-200 bg-white/75 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-sm font-bold text-zinc-950">
                    {entry.text}
                  </p>
                  <span className="shrink-0 text-xs font-bold text-zinc-400">
                    R{entry.round}
                  </span>
                </div>
              </article>
            ))
        )}
      </div>
    </Panel>
  );
}
