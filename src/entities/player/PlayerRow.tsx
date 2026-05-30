import { Player, PublicPlayer, roleLabels } from "../../types/game";

type PlayerRowProps = {
  player: Player | PublicPlayer;
  revealRole?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function PlayerRow({
  player,
  revealRole = false,
  selected = false,
  onClick,
}: PlayerRowProps) {
  const roleText =
    player.role && revealRole
      ? roleLabels[player.role]
      : player.alive
      ? "Роль скрыта"
      : "Выбыл";

  return (
    <button
      type="button"
      className={[
        "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border px-3 py-2 text-left transition duration-200",
        selected
          ? "border-zinc-950 bg-zinc-950 text-white"
          : "border-zinc-200 bg-white/75 hover:border-zinc-400 hover:bg-white",
        !player.alive ? "opacity-60" : "",
      ].join(" ")}
      onClick={onClick}
    >
      <span className={selected ? "text-white/80" : "text-zinc-500"}>♟</span>
      <span className="min-w-0">
        <span
          className={[
            "block truncate text-sm font-bold",
            selected ? "text-white" : "text-zinc-950",
          ].join(" ")}
        >
          {player.name}
        </span>
        <span
          className={[
            "block truncate text-xs",
            selected ? "text-white/70" : "text-zinc-500",
          ].join(" ")}
        >
          {roleText}
        </span>
      </span>
      <span
        className={[
          "rounded-full px-3 py-1 text-xs font-bold",
          selected ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-500",
        ].join(" ")}
      >
        {player.score}
      </span>
    </button>
  );
}
