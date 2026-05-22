import React from 'react'
import { PlayerRow } from '../../entities/player/PlayerRow'
import { Button } from '../../shared/ui/Button'
import { GameSnapshot, NightActionType, Player, PlayerId, Vote, roleLabels } from '../../types/game'

type PlayerActionPanelProps = {
  snapshot: GameSnapshot
  selfPlayer: Player
  selectedPlayerId?: PlayerId
  developerMode?: boolean
  onSelectPlayer: (playerId: PlayerId) => void
  onNightAction: (type: NightActionType, targetId: PlayerId) => void
  onVote: (vote: Vote) => void
}

export function PlayerActionPanel({
  snapshot,
  selfPlayer,
  selectedPlayerId,
  developerMode = false,
  onSelectPlayer,
  onNightAction,
  onVote
}: PlayerActionPanelProps) {
  const [selectedAction, setSelectedAction] = React.useState<NightActionType>(getDefaultNightAction(selfPlayer))
  const [bet, setBet] = React.useState(0)
  const aliveTargets = snapshot.players.filter((player) => player.alive)
  const selectedPlayer = snapshot.players.find((player) => player.id === selectedPlayerId)
  const canUseNightAction = selfPlayer.alive && snapshot.phase === 'Night' && selfPlayer.role !== 'civilian'
  const canVote = selfPlayer.alive && snapshot.phase === 'Voting'

  React.useEffect(() => {
    setSelectedAction(getDefaultNightAction(selfPlayer))
  }, [selfPlayer.id, selfPlayer.role, snapshot.phase])

  return (
    <section className="grid min-h-0 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Вы</p>
          <p className="text-xl font-black text-text">{roleLabels[selfPlayer.role]}</p>
        </div>
        <p className="rounded-full bg-surface px-3 py-1 text-sm font-bold text-muted">{selfPlayer.score}</p>
      </div>

      {canUseNightAction ? (
        <div className="grid grid-cols-2 gap-2">
          {getAvailableNightActions(selfPlayer).map((action) => (
            <Button
              key={action.type}
              variant={selectedAction === action.type ? 'primary' : 'secondary'}
              className="h-11 px-3 py-2 text-xs"
              onClick={() => setSelectedAction(action.type)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {canVote && snapshot.settings.bettingMode ? (
        <label className="rounded-xl bg-surface/80 p-3">
          <span className="mb-2 block text-xs font-semibold text-muted">Ставка: {bet}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, selfPlayer.score)}
            value={bet}
            onChange={(event) => setBet(Number(event.target.value))}
            className="w-full accent-accent"
          />
        </label>
      ) : null}

      <div className="grid min-h-0 gap-2 overflow-auto pr-1">
        {aliveTargets.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            selected={selectedPlayerId === player.id}
            revealRole={developerMode || snapshot.phase === 'GameOver' || player.id === selfPlayer.id}
            onClick={() => {
              onSelectPlayer(player.id)

              if (canUseNightAction) {
                onNightAction(selectedAction, player.id)
              }

              if (canVote) {
                onVote({
                  voterId: selfPlayer.id,
                  targetId: player.id,
                  bet
                })
              }
            }}
          />
        ))}
      </div>

      <div className="min-h-10 rounded-xl bg-surface/80 px-4 py-3 text-sm font-medium text-muted">
        {getStatusText(snapshot, selfPlayer, selectedPlayer, selectedAction)}
      </div>
    </section>
  )
}

function getStatusText(
  snapshot: GameSnapshot,
  selfPlayer: Player,
  selectedPlayer: Player | undefined,
  selectedAction: NightActionType
): string {
  if (!selfPlayer.alive) return 'Вы наблюдаете за игрой'
  if (snapshot.phase === 'Night' && selfPlayer.role === 'civilian') return 'Ночь. Ожидайте'
  if (snapshot.phase === 'Night') return selectedPlayer ? `${getActionLabel(selectedAction)}: ${selectedPlayer.name}` : 'Выберите игрока'
  if (snapshot.phase === 'Voting') return selectedPlayer ? `Голос: ${selectedPlayer.name}` : 'Выберите игрока'
  return selectedPlayer ? selectedPlayer.name : 'Выберите игрока'
}

function getDefaultNightAction(player: Player): NightActionType {
  if (player.role === 'mafia') return 'mafiaKill'
  if (player.role === 'doctor') return 'doctorHeal'
  if (player.role === 'detective') return 'detectiveCheck'
  return 'detectiveCheck'
}

function getAvailableNightActions(player: Player): Array<{ type: NightActionType; label: string }> {
  if (player.role === 'mafia') return [{ type: 'mafiaKill', label: 'Убить' }]
  if (player.role === 'doctor') return [{ type: 'doctorHeal', label: 'Лечить' }]

  if (player.role === 'detective') {
    return [
      { type: 'detectiveCheck', label: 'Роль' },
      { type: 'detectiveKill', label: 'Убить' }
    ]
  }

  return []
}

function getActionLabel(action: NightActionType): string {
  if (action === 'doctorHeal') return 'Лечение'
  if (action === 'detectiveCheck') return 'Проверка'
  return 'Цель'
}
