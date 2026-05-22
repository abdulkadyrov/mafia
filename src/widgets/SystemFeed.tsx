import { Panel } from '../shared/ui/Panel'
import { GameSnapshot, PlayerId } from '../types/game'

type SystemFeedProps = {
  snapshot: GameSnapshot
  selfPlayerId?: PlayerId
}

export function SystemFeed({ snapshot, selfPlayerId }: SystemFeedProps) {
  const visibleHistory = snapshot.history.filter((entry) => {
    return !entry.privateFor || entry.privateFor === selfPlayerId
  })

  return (
    <Panel>
      <h2 className="mb-4 text-lg font-semibold text-text">Системный чат</h2>
      <div className="max-h-80 space-y-3 overflow-auto pr-1">
        {visibleHistory.length === 0 ? (
          <p className="text-sm text-muted">События появятся здесь после старта игры.</p>
        ) : (
          visibleHistory
            .slice()
            .reverse()
            .map((entry) => (
              <article key={entry.id} className="rounded-xl bg-card/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-text">{entry.text}</p>
                  <span className="shrink-0 text-xs text-muted">R{entry.round}</span>
                </div>
              </article>
            ))
        )}
      </div>
    </Panel>
  )
}
