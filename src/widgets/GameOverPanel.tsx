import { PlayerRow } from '../entities/player/PlayerRow'
import { Panel } from '../shared/ui/Panel'
import { GameSnapshot } from '../types/game'

type GameOverPanelProps = {
  snapshot: GameSnapshot
}

export function GameOverPanel({ snapshot }: GameOverPanelProps) {
  const mvp = snapshot.players.find((player) => player.id === snapshot.mvpPlayerId)

  if (snapshot.phase !== 'GameOver') {
    return null
  }

  return (
    <Panel className="border-accent/40 bg-accent/10">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">Game Over</p>
      <h2 className="mt-2 text-3xl font-black text-text">
        Победа {snapshot.winner === 'mafia' ? 'мафии' : 'города'}
      </h2>
      {mvp ? <p className="mt-2 text-sm text-muted">MVP: {mvp.name}</p> : null}
      <div className="mt-5 grid gap-2">
        {snapshot.players.map((player) => (
          <PlayerRow key={player.id} player={player} revealRole />
        ))}
      </div>
    </Panel>
  )
}
