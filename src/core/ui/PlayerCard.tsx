import { Avatar } from "./Avatar";
import type { MafiaPlayerView } from "../room/mafiaRoomTypes";

export function PlayerCard({
  player,
  selected = false,
  disabled = false,
  compact = false,
  onClick,
  actions,
}: {
  player: MafiaPlayerView;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
}) {
  const dead = player.life_status === "dead";
  const disconnected = player.life_status === "disconnected";
  return (
    <article
      className={[
        "mafia-player-card",
        selected ? "mafia-player-card--selected" : "",
        dead ? "mafia-player-card--dead" : "",
        disconnected ? "mafia-player-card--offline" : "",
        compact ? "mafia-player-card--compact" : "",
      ].filter(Boolean).join(" ")}
      onClick={disabled ? undefined : onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={(event) => { if (onClick && !disabled && (event.key === "Enter" || event.key === " ")) onClick(); }}
      aria-disabled={disabled || undefined}
    >
      <div className="mafia-player-portrait">
        <Avatar name={player.display_name} url={player.avatar_url} size={compact ? "small" : "large"} />
        {player.is_host ? <span className="mafia-host-crown" title="Ведущий">♛</span> : null}
        {dead ? <span className="mafia-death-mark" title="Погиб">†</span> : null}
      </div>
      <div className="mafia-player-meta">
        <strong>{player.display_name}</strong>
        <span className={`mafia-player-state mafia-player-state--${dead ? "dead" : disconnected ? "offline" : player.is_ready ? "ready" : "waiting"}`}>
          {dead ? "Погиб" : disconnected ? "Нет связи" : player.is_ready ? "Готов" : "Не готов"}
        </span>
        <div className="mafia-device-badges" aria-label="Состояние устройств">
          <span className={player.microphone_enabled && !player.microphone_blocked ? "on" : "off"}>{player.microphone_enabled ? "● Мик" : "○ Мик"}</span>
          <span className={player.camera_enabled ? "on" : "off"}>{player.camera_enabled ? "● Кам" : "○ Кам"}</span>
          <span className={`quality quality--${player.connection_quality}`}>◉</span>
        </div>
      </div>
      {actions ? <div className="mafia-player-actions" onClick={(event) => event.stopPropagation()}>{actions}</div> : null}
    </article>
  );
}
