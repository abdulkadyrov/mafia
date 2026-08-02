import React from "react";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaEvent, MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { roleRegistry } from "../../core/roles/roleRegistry";
import { Avatar } from "../../core/ui/Avatar";
import { MafiaBackground } from "../../core/ui/MafiaBackground";

export function GameResultsScreen({ snapshot, applySnapshot, onHome, onNewRoom }: {
  snapshot: MafiaSnapshot;
  applySnapshot: (snapshot: MafiaSnapshot) => void;
  onHome: () => void;
  onNewRoom: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const renderedAt = React.useRef(Date.now()).current;
  const winner = snapshot.game?.winning_team ?? "draw";
  const startedAt = snapshot.game ? new Date(snapshot.game.started_at).getTime() : renderedAt;
  const endedAt = snapshot.game?.ended_at ? new Date(snapshot.game.ended_at).getTime() : renderedAt;
  const durationMinutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000));

  async function rematch() {
    setBusy(true);
    setError("");
    try { applySnapshot(await mafiaCommands.rematch(snapshot.room.id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось начать реванш"); }
    finally { setBusy(false); }
  }

  async function share() {
    const text = `${winnerLabel(winner)} в «${snapshot.room.name}». ${snapshot.game?.round_number ?? 0} раундов, ${durationMinutes} мин.`;
    try {
      if (navigator.share) await navigator.share({ title: "Результаты Mafia", text });
      else { await navigator.clipboard.writeText(text); setError("Результат скопирован"); }
    } catch { /* системный диалог закрыт */ }
  }

  return (
    <main className={`mafia-page mafia-results-page mafia-results-page--${winner}`}>
      <MafiaBackground name={winner === "mafia" ? "mafia-win" : winner === "city" ? "city-win" : "defeat"} />
      <section className="mafia-results-shell">
        <header className="mafia-results-header">
          <span className="mafia-eyebrow">Игра завершена</span>
          <h1>{winnerLabel(winner)}</h1>
          <p>{durationMinutes} мин · {snapshot.game?.round_number ?? 0} дней и ночей · комната {snapshot.room.code}</p>
        </header>

        <section className="mafia-results-players">
          <div className="mafia-section-heading"><div><span className="mafia-eyebrow">Роли и результаты</span><h2>Кто кем был</h2></div></div>
          <div className="mafia-results-grid">
            {snapshot.players.map((player) => {
              const definition = player.role ? roleRegistry[player.role] : null;
              return (
                <article key={player.id} className={`mafia-result-card mafia-result-card--${player.team ?? "unknown"}`}>
                  <Avatar name={player.display_name} url={player.avatar_url} size="large" />
                  <div><strong>{player.display_name}</strong><span>{definition?.name ?? "Роль скрыта"}</span><em>{player.life_status === "dead" ? "Погиб" : "Выжил"}{typeof player.score === "number" ? ` · ${player.score} оч.` : ""}</em></div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mafia-timeline">
          <span className="mafia-eyebrow">Хроника партии</span>
          <div>{snapshot.events.filter((event) => ["player_died", "player_executed", "vote_tied", "night_resolved", "commissioner_result", "game_finished"].includes(event.event_type)).map((event) => (
            <article key={event.id}><span>{event.round_number}</span><div><strong>{eventLabel(event.event_type)}</strong><p>{eventDescription(event, snapshot)}</p><time>{new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.created_at))}</time></div></article>
          ))}</div>
        </section>

        <footer className="mafia-results-actions">
          <button className="mafia-secondary-button" onClick={onHome}>Вернуться в меню</button>
          <button className="mafia-secondary-button" onClick={onNewRoom}>Новая комната</button>
          <button className="mafia-secondary-button" onClick={() => void share()}>Поделиться результатом</button>
          {snapshot.self.isHost ? <button className="mafia-primary-button" disabled={busy} onClick={() => void rematch()}>{busy ? "Перемешиваем роли…" : "Играть ещё"}</button> : null}
        </footer>
        {error ? <div className="mafia-toast">{error}</div> : null}
      </section>
    </main>
  );
}

function winnerLabel(winner: string) {
  if (winner === "mafia") return "Мафия победила!";
  if (winner === "city") return "Город победил!";
  if (winner === "maniac") return "Маньяк победил!";
  return "Ничья";
}

function eventLabel(type: string) {
  if (type === "player_died") return "Ночное убийство";
  if (type === "player_executed") return "Решение города";
  if (type === "vote_tied") return "Ничья в голосовании";
  if (type === "commissioner_result") return "Проверка комиссара";
  if (type === "night_resolved") return "Итоги ночи";
  return "Победитель определён";
}

function eventDescription(event: MafiaEvent, snapshot: MafiaSnapshot) {
  const name = (id: unknown) => snapshot.players.find((player) => player.gamePlayerId === id)?.display_name ?? "никто";
  if (event.event_type === "player_died") return `Погиб: ${name(event.payload.playerId)}.`;
  if (event.event_type === "player_executed") {
    const counts = event.payload.counts && typeof event.payload.counts === "object" ? event.payload.counts as Record<string, number> : {};
    const votes = Object.entries(counts).map(([id, count]) => `${name(id)} — ${count}`).join(", ");
    return `Исключён: ${name(event.payload.eliminatedPlayerId)}.${votes ? ` Голоса: ${votes}.` : ""}`;
  }
  if (event.event_type === "vote_tied") {
    const ids = Array.isArray(event.payload.tiedPlayerIds) ? event.payload.tiedPlayerIds : [];
    return ids.length ? `Одинаковое число голосов: ${ids.map(name).join(", ")}.` : "Город не выбрал кандидата.";
  }
  if (event.event_type === "commissioner_result") return `${name(event.payload.targetGamePlayerId)} — ${event.payload.isMafia ? "мафия" : "не мафия"}.`;
  if (event.event_type === "night_resolved") {
    const killed = Array.isArray(event.payload.killedPlayerIds) ? event.payload.killedPlayerIds.map(name) : [];
    const saved = Array.isArray(event.payload.savedPlayerIds) ? event.payload.savedPlayerIds.map(name) : [];
    return `${killed.length ? `Убиты: ${killed.join(", ")}.` : "Никто не погиб."}${saved.length ? ` Спасены: ${saved.join(", ")}.` : ""}`;
  }
  return `Победитель: ${winnerLabel(String(event.payload.winner ?? "draw"))}`;
}
