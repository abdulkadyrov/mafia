import { Player, PublicPlayer, roleLabels } from '../../types/game'

type PlayerRowProps = {
  player: Player | PublicPlayer
  revealRole?: boolean
  selected?: boolean
  onClick?: () => void
}

export function PlayerRow({ player, revealRole = false, selected = false, onClick }: PlayerRowProps) {
  const roleText = player.role && revealRole ? roleLabels[player.role] : player.alive ? 'Роль скрыта' : 'Выбыл'

  return (
    <button
      type="button"
      className={[
        'grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-4 py-3 text-left transition duration-300',
        selected ? 'border-accent bg-accent/15' : 'border-white/10 bg-card/70 hover:border-white/20 hover:bg-card',
        !player.alive ? 'opacity-60' : ''
      ].join(' ')}
      onClick={onClick}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-text">{player.name}</span>
        <span className="block truncate text-xs text-muted">{roleText}</span>
      </span>
      <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">{player.score}</span>
    </button>
  )
}
