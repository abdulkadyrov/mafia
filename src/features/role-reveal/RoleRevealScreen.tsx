import React from "react";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { getRoleDefinition } from "../../core/roles/roleRegistry";
import { mafiaImages } from "../../core/media/imageManifest";
import { MafiaBackground } from "../../core/ui/MafiaBackground";

export function RoleRevealScreen({ snapshot, applySnapshot }: { snapshot: MafiaSnapshot; applySnapshot: (snapshot: MafiaSnapshot) => void }) {
  const [revealed, setRevealed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const holdRef = React.useRef<number | null>(null);
  const role = snapshot.self.role;
  const definition = role ? getRoleDefinition(role) : null;
  const acknowledged = Boolean(snapshot.self.roleAcknowledgedAt);
  const acknowledgedCount = snapshot.players.filter((player) => {
    const event = snapshot.events.find((item) => item.event_type === "role_acknowledged" && item.payload.userId === player.user_id);
    return Boolean(event) || player.user_id === snapshot.room.host_user_id && acknowledged;
  }).length;

  function startHold() {
    if (acknowledged) return;
    holdRef.current = window.setTimeout(() => setRevealed(true), 650);
  }
  function cancelHold() {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = null;
  }
  async function acknowledge() {
    setBusy(true);
    setError("");
    try {
      const next = await mafiaCommands.acknowledgeRole(snapshot.room.id);
      setRevealed(false);
      applySnapshot(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось подтвердить роль");
    } finally {
      setBusy(false);
    }
  }
  async function advance() {
    setBusy(true);
    setError("");
    try { applySnapshot(await mafiaCommands.advancePhase(snapshot.room.id, snapshot.room.phase_version)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось начать ночь"); }
    finally { setBusy(false); }
  }

  return (
    <main className="mafia-page mafia-role-page">
      <MafiaBackground name="results" />
      <section className="mafia-role-reveal-layout">
        <header>
          <span className="mafia-eyebrow">Секретная информация</span>
          <h1>{acknowledged ? "Роль скрыта" : "Узнайте свою роль"}</h1>
          <p>{acknowledged ? "Вы подтвердили роль. Дождитесь остальных игроков." : "Убедитесь, что никто не смотрит на экран. Удерживайте кнопку, чтобы открыть карту."}</p>
        </header>

        <div className={`mafia-role-card ${revealed ? "mafia-role-card--revealed" : ""}`}>
          <div className="mafia-role-card-inner">
            <div className="mafia-role-card-back"><span>♠</span><strong>MAFIA</strong><em>Не доверяй никому</em></div>
            <div className="mafia-role-card-front">
              {definition ? (
                <picture>
                  <source srcSet={mafiaImages.role(definition.id).avif} type="image/avif" />
                  <img src={mafiaImages.role(definition.id).webp} alt="" />
                </picture>
              ) : null}
              <div><span>{definition?.team === "mafia" ? "Тёмная сторона" : definition?.team === "city" ? "Сторона города" : "Особая роль"}</span><h2>{definition?.name ?? "Роль"}</h2><p>{definition?.shortDescription}</p></div>
            </div>
          </div>
        </div>

        {!acknowledged && !revealed ? (
          <button
            className="mafia-reveal-hold-button"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
          >Удерживайте, чтобы показать роль</button>
        ) : null}
        {revealed && definition ? (
          <section className="mafia-role-rules">
            <h3>Как играть</h3>
            <ul>{definition.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            <button className="mafia-primary-button" disabled={busy} onClick={() => void acknowledge()}>{busy ? "Скрываем…" : "Я запомнил"}</button>
          </section>
        ) : null}

        {acknowledged ? <div className="mafia-role-waiting"><span className="mafia-ready-check">✓</span><strong>Роль подтверждена</strong><p>{acknowledgedCount || 1} игроков готовы продолжить</p></div> : null}
        {snapshot.self.isHost && acknowledged ? <button className="mafia-primary-button mafia-host-advance" disabled={busy} onClick={() => void advance()}>Начать ночь</button> : null}
        {error ? <div className="mafia-toast">{error}</div> : null}
      </section>
    </main>
  );
}
