import React from "react";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { getRoleDefinition } from "../../core/roles/roleRegistry";
import type { MafiaRole, RoleCounts } from "../../core/roles/roleTypes";

const ROLES: Exclude<MafiaRole, "host">[] = [
  "mafia", "don", "doctor", "commissioner", "civilian", "maniac", "mistress", "bodyguard",
];

export function HostTestToolsModal({ open, snapshot, onClose, onSaved }: {
  open: boolean;
  snapshot: MafiaSnapshot;
  onClose: () => void;
  onSaved: (snapshot: MafiaSnapshot) => void;
}) {
  const [mode, setMode] = React.useState<"random" | "manual">("random");
  const [assignments, setAssignments] = React.useState<Record<string, MafiaRole>>({});
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const players = snapshot.players.filter((player) => !player.is_host && player.life_status !== "disconnected");
  const freeSlots = Math.max(0, snapshot.room.max_players - snapshot.players.length);
  const required = requiredRoleCounts(snapshot.room.settings.roles, players.length);
  const assigned = countAssignments(players.map((player) => assignments[player.id]));
  const validManual = players.length > 0 && ROLES.every((role) => (assigned[role] ?? 0) === (required[role] ?? 0));

  React.useEffect(() => {
    if (!open) return;
    const nextMode = snapshot.room.settings.roleAssignmentMode ?? "random";
    setMode(nextMode);
    setAssignments(seedAssignments(snapshot));
    setError("");
  }, [open, snapshot]);

  if (!open) return null;

  async function run(label: string, action: () => Promise<MafiaSnapshot>) {
    setBusy(label);
    setError("");
    try { onSaved(await action()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось выполнить действие"); }
    finally { setBusy(""); }
  }

  return (
    <div className="mafia-modal-backdrop" onMouseDown={onClose}>
      <section className="mafia-modal mafia-host-tools-modal" role="dialog" aria-modal="true" aria-labelledby="host-tools-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="mafia-modal-close" onClick={onClose} aria-label="Закрыть управление тестированием">×</button>
        <span className="mafia-eyebrow">Только ведущий</span>
        <h2 id="host-tools-title">Боты и роли</h2>
        <p className="mafia-muted-copy">Боты играют сами: подтверждают роль, выполняют ночные действия, обсуждают и голосуют. Уровень логики — средний, без знания чужих ролей.</p>

        <section className="mafia-host-tools-section">
          <div className="mafia-section-heading"><div><strong>Тестовые игроки</strong><small>{snapshot.players.filter((player) => player.is_bot).length} ботов · {freeSlots} мест свободно</small></div></div>
          <div className="mafia-modal-actions mafia-bot-actions">
            <button className="mafia-secondary-button" disabled={Boolean(busy) || freeSlots === 0} onClick={() => void run("add-one", () => mafiaCommands.addBots(snapshot.room.id, 1))}>+ 1 бот</button>
            <button className="mafia-secondary-button" disabled={Boolean(busy) || freeSlots === 0} onClick={() => void run("fill", () => mafiaCommands.addBots(snapshot.room.id, freeSlots))}>Заполнить комнату</button>
          </div>
        </section>

        <section className="mafia-host-tools-section">
          <label className="mafia-field"><span>Назначение ролей</span><select value={mode} onChange={(event) => setMode(event.target.value as "random" | "manual")}><option value="random">Случайно</option><option value="manual">Ведущий назначает сам</option></select></label>
          {mode === "manual" ? (
            <>
              <div className="mafia-role-balance" aria-label="Баланс ручных ролей">
                {ROLES.filter((role) => (required[role] ?? 0) > 0).map((role) => {
                  const complete = assigned[role] === required[role];
                  return <span key={role} className={complete ? "complete" : ""}>{getRoleDefinition(role).name}: {assigned[role] ?? 0}/{required[role]}</span>;
                })}
              </div>
              <div className="mafia-manual-role-list">
                {players.map((player) => (
                  <div className="mafia-manual-role-row" key={player.id}>
                    <div><strong>{player.display_name}</strong>{player.is_bot ? <span className="mafia-bot-badge">BOT · средний</span> : <small>Игрок</small>}</div>
                    <select aria-label={`Роль для ${player.display_name}`} value={assignments[player.id] ?? ""} onChange={(event) => setAssignments({ ...assignments, [player.id]: event.target.value as MafiaRole })}>
                      <option value="" disabled>Выберите роль</option>
                      {ROLES.map((role) => <option key={role} value={role}>{getRoleDefinition(role).name}</option>)}
                    </select>
                    {player.is_bot ? <button className="mafia-icon-button danger" aria-label={`Удалить бота ${player.display_name}`} disabled={Boolean(busy)} onClick={() => void run(`remove-${player.id}`, () => mafiaCommands.removeBot(snapshot.room.id, player.id))}>×</button> : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mafia-manual-role-list">
              {players.filter((player) => player.is_bot).map((player) => (
                <div className="mafia-manual-role-row" key={player.id}><div><strong>{player.display_name}</strong><span className="mafia-bot-badge">BOT · средний</span></div><span>Роль выпадет случайно</span><button className="mafia-icon-button danger" aria-label={`Удалить бота ${player.display_name}`} disabled={Boolean(busy)} onClick={() => void run(`remove-${player.id}`, () => mafiaCommands.removeBot(snapshot.room.id, player.id))}>×</button></div>
              ))}
            </div>
          )}
        </section>

        {error ? <div className="mafia-form-error" role="alert">{error}</div> : null}
        <div className="mafia-modal-actions">
          <button className="mafia-secondary-button" onClick={onClose}>Закрыть</button>
          <button className="mafia-primary-button" disabled={Boolean(busy) || (mode === "manual" && !validManual)} onClick={() => void run("save", () => mafiaCommands.configureRoles(snapshot.room.id, mode, assignments))}>{busy === "save" ? "Сохраняем…" : "Сохранить роли"}</button>
        </div>
      </section>
    </div>
  );
}

function requiredRoleCounts(configured: RoleCounts, playerCount: number): RoleCounts {
  const result: RoleCounts = {};
  let special = 0;
  for (const role of ROLES) {
    if (role === "civilian") continue;
    const count = Math.max(0, Number(configured[role] ?? 0));
    result[role] = count;
    special += count;
  }
  result.civilian = Math.max(0, playerCount - special);
  return result;
}

function countAssignments(roles: Array<MafiaRole | undefined>): RoleCounts {
  return roles.reduce<RoleCounts>((result, role) => {
    if (role && role !== "host") result[role] = (result[role] ?? 0) + 1;
    return result;
  }, {});
}

function seedAssignments(snapshot: MafiaSnapshot): Record<string, MafiaRole> {
  const players = snapshot.players.filter((player) => !player.is_host && player.life_status !== "disconnected");
  const saved = snapshot.room.settings.manualRoles ?? {};
  const required = requiredRoleCounts(snapshot.room.settings.roles, players.length);
  const available = ROLES.flatMap((role) => Array.from({ length: required[role] ?? 0 }, () => role));
  const result: Record<string, MafiaRole> = {};
  for (const player of players) {
    const savedRole = saved[player.id];
    const index = savedRole ? available.indexOf(savedRole as Exclude<MafiaRole, "host">) : -1;
    if (savedRole && savedRole !== "host" && index >= 0) {
      result[player.id] = savedRole;
      available.splice(index, 1);
    }
  }
  for (const player of players) {
    if (!result[player.id] && available[0]) result[player.id] = available.shift()!;
  }
  return result;
}
