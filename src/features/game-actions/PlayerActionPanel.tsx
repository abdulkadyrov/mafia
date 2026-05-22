import React from 'react'
import { PlayerRow } from '../../entities/player/PlayerRow'
import { Button } from '../../shared/ui/Button'
import { Panel } from '../../shared/ui/Panel'
import { GameSnapshot, NightActionType, Player, PlayerId, Vote, roleLabels } from '../../types/game'

type PlayerActionPanelProps = {
  snapshot: GameSnapshot
  selfPlayer: Player
  onNightAction: (type: NightActionType, targetId: PlayerId) => void
  onVote: (vote: Vote) => void
}

export function PlayerActionPanel({ snapshot, selfPlayer, onNightAction, onVote }: PlayerActionPanelProps) {
  const [selectedTargetId, setSelectedTargetId] = React.useState<PlayerId>()
  const [selectedAction, setSelectedAction] = React.useState<NightActionType>(getDefaultNightAction(selfPlayer))
  const [bet, setBet] = React.useState(0)
  const aliveTargets = snapshot.players.filter((player) => player.alive)
  const canAct = selfPlayer.alive && snapshot.phase === 'Night' && selfPlayer.role !== 'civilian'
  const canVote = selfPlayer.alive && snapshot.phase === 'Voting'

  React.useEffect(() => {
    setSelectedAction(getDefaultNightAction(selfPlayer))
    setSelectedTargetId(undefined)
  }, [selfPlayer.id, selfPlayer.role, snapshot.phase])

  if (!selfPlayer.alive) {
    return (
      <Panel>
        <h2 className="text-lg font-semibold text-text">Режим наблюдателя</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Вы остаетесь в комнате, видите системный чат и историю, но не участвуете в голосовании и ночных действиях.
        </p>
      </Panel>
    )
  }

  if (snapshot.phase === 'Night' && selfPlayer.role === 'civilian') {
    return (
      <Panel className="text-center">
        <p className="text-sm font-medium text-muted">Ночь</p>
        <h2 className="mt-2 text-3xl font-black text-text">Ожидайте...</h2>
        <p className="mt-3 text-sm text-muted">Мирные жители не выполняют ночные действия.</p>
      </Panel>
    )
  }

  if (!canAct && !canVote) {
    return (
      <Panel>
        <h2 className="text-lg font-semibold text-text">Ваша роль</h2>
        <p className="mt-2 text-2xl font-black text-text">{roleLabels[selfPlayer.role]}</p>
        <p className="mt-2 text-sm text-muted">Доступные действия появятся в нужной фазе.</p>
      </Panel>
    )
  }

  return (
    <Panel>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text">{snapshot.phase === 'Night' ? 'Ночное действие' : 'Голосование'}</h2>
        <p className="mt-1 text-sm text-muted">{roleLabels[selfPlayer.role]}</p>
      </div>

      {snapshot.phase === 'Night' ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {getAvailableNightActions(selfPlayer).map((action) => (
            <Button
              key={action.type}
              variant={selectedAction === action.type ? 'primary' : 'secondary'}
              onClick={() => setSelectedAction(action.type)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2">
        {aliveTargets.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            selected={selectedTargetId === player.id}
            revealRole={player.id === selfPlayer.id}
            onClick={() => setSelectedTargetId(player.id)}
          />
        ))}
      </div>

      {snapshot.phase === 'Voting' && snapshot.settings.bettingMode ? (
        <label className="mt-4 block rounded-xl bg-card/70 p-4">
          <span className="mb-2 block text-sm font-medium text-muted">Ставка очков</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, selfPlayer.score)}
            value={bet}
            onChange={(event) => setBet(Number(event.target.value))}
            className="w-full accent-accent"
          />
          <span className="mt-2 block text-sm font-semibold text-text">{bet}</span>
        </label>
      ) : null}

      <Button
        className="mt-4 w-full"
        disabled={!selectedTargetId}
        onClick={() => {
          if (!selectedTargetId) return

          if (snapshot.phase === 'Night') {
            onNightAction(selectedAction, selectedTargetId)
            return
          }

          onVote({
            voterId: selfPlayer.id,
            targetId: selectedTargetId,
            bet
          })
        }}
      >
        Подтвердить
      </Button>
    </Panel>
  )
}

function getDefaultNightAction(player: Player): NightActionType {
  if (player.role === 'mafia') return 'mafiaKill'
  if (player.role === 'doctor') return 'doctorHeal'
  if (player.role === 'detective') return 'detectiveCheck'
  return 'detectiveCheck'
}

function getAvailableNightActions(player: Player): Array<{ type: NightActionType; label: string }> {
  if (player.role === 'mafia') {
    return [{ type: 'mafiaKill', label: 'Выбрать жертву' }]
  }

  if (player.role === 'doctor') {
    return [{ type: 'doctorHeal', label: 'Лечить' }]
  }

  if (player.role === 'detective') {
    return [
      { type: 'detectiveCheck', label: 'Проверить роль' },
      { type: 'detectiveKill', label: 'Убить' }
    ]
  }

  return []
}
