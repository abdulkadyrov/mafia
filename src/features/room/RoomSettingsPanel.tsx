import React from "react";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaRoomSettings, MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { changePlayerLimit, changeRoleCount } from "./roleSettings";

export function RoomSettingsPanel({ snapshot, open, onClose, onSaved, onCancel }: {
  snapshot: MafiaSnapshot;
  open: boolean;
  onClose: () => void;
  onSaved: (snapshot: MafiaSnapshot) => void;
  onCancel: () => void;
}) {
  const [settings, setSettings] = React.useState<MafiaRoomSettings>(() => fromSnapshot(snapshot));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { if (open) setSettings(fromSnapshot(snapshot)); }, [open, snapshot]);
  if (!open) return null;

  async function save() {
    setSaving(true);
    setError("");
    try {
      onSaved(await mafiaCommands.updateRoom(snapshot.room.id, settings));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mafia-modal-backdrop" onMouseDown={onClose}>
      <section className="mafia-modal mafia-room-settings-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="mafia-modal-close" onClick={onClose}>×</button>
        <span className="mafia-eyebrow">Только ведущий</span>
        <h2>Настройки комнаты</h2>
        <div className="mafia-settings-form">
          <label className="mafia-field"><span>Название</span><input value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></label>
          <label className="mafia-field"><span>Максимум участников</span><select value={settings.maxPlayers} onChange={(event) => setSettings(changePlayerLimit(settings, Number(event.target.value)))}>{Array.from({ length: 11 }, (_, index) => index + 6).map((count) => <option key={count}>{count}</option>)}</select></label>
          <div className="mafia-three-columns">
            <NumberField label="Ночь" value={settings.nightSeconds} onChange={(value) => setSettings({ ...settings, nightSeconds: value })} />
            <NumberField label="Обсуждение" value={settings.discussionSeconds} onChange={(value) => setSettings({ ...settings, discussionSeconds: value })} />
            <NumberField label="Голосование" value={settings.votingSeconds} onChange={(value) => setSettings({ ...settings, votingSeconds: value })} />
          </div>
          <div className="mafia-role-counters">
            {(["mafia", "don", "doctor", "commissioner", "maniac", "mistress", "bodyguard"] as const).map((role) => (
              <RoleCounter key={role} label={roleLabel(role)} value={Number(settings.roles[role] ?? 0)} onChange={(value) => setSettings(changeRoleCount(settings, role, value))} />
            ))}
            <RoleCounter label="Мирные" value={Number(settings.roles.civilian ?? 0)} onChange={(value) => setSettings(changeRoleCount(settings, "civilian", value))} />
          </div>
          <div className="mafia-toggle-grid">
            <Toggle label="Приватная комната" value={settings.isPrivate} onChange={(value) => setSettings({ ...settings, isPrivate: value })} />
            <Toggle label="Видеосвязь" value={settings.videoEnabled} onChange={(value) => setSettings({ ...settings, videoEnabled: value })} />
            <Toggle label="Камера обязательна" value={settings.cameraRequired} onChange={(value) => setSettings({ ...settings, cameraRequired: value })} />
            <Toggle label="Автопереход фаз" value={settings.autoPhase} onChange={(value) => setSettings({ ...settings, autoPhase: value })} />
            <Toggle label="Игровой чат" value={settings.chatEnabled} onChange={(value) => setSettings({ ...settings, chatEnabled: value })} />
            <Toggle label="Чат погибших" value={settings.deadChatEnabled} onChange={(value) => setSettings({ ...settings, deadChatEnabled: value })} />
            <Toggle label="Наблюдение после смерти" value={settings.deadCanObserve} onChange={(value) => setSettings({ ...settings, deadCanObserve: value })} />
            <Toggle label="Погибшие читают чат живых" value={settings.deadCanReadAliveChat} onChange={(value) => setSettings({ ...settings, deadCanReadAliveChat: value })} />
            <Toggle label="Разрешить смену голоса" value={settings.allowVoteChange} onChange={(value) => setSettings({ ...settings, allowVoteChange: value })} />
            <Toggle label="Роли назначает ведущий" value={settings.roleAssignmentMode === "manual"} onChange={(value) => setSettings({ ...settings, roleAssignmentMode: value ? "manual" : "random" })} />
          </div>
          <label className="mafia-field"><span>Правило ничьей</span><select value={settings.tieRule} onChange={(event) => setSettings({ ...settings, tieRule: event.target.value as MafiaRoomSettings["tieRule"] })}><option value="no_execution">Никого не исключать</option><option value="revote">Повторить голосование</option></select></label>
        </div>
        {error ? <p className="mafia-form-error">{error}</p> : null}
        <div className="mafia-modal-actions">
          <button className="mafia-secondary-button danger" onClick={onCancel}>Отменить комнату</button>
          <button className="mafia-secondary-button" onClick={onClose}>Отмена</button>
          <button className="mafia-primary-button" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </section>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="mafia-field"><span>{label}, сек</span><input type="number" min={15} max={900} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="mafia-toggle"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

function RoleCounter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="mafia-role-counter"><span>{label}</span><div><button type="button" onClick={() => onChange(value - 1)} aria-label={`Уменьшить ${label}`}>−</button><strong>{value}</strong><button type="button" onClick={() => onChange(value + 1)} aria-label={`Увеличить ${label}`}>+</button></div></div>;
}

function roleLabel(role: keyof MafiaRoomSettings["roles"]) {
  return { mafia: "Мафия", don: "Дон", doctor: "Доктор", commissioner: "Комиссар", maniac: "Маньяк", mistress: "Любовница", bodyguard: "Телохранитель", civilian: "Мирные", host: "Ведущий" }[role];
}

function fromSnapshot(snapshot: MafiaSnapshot): MafiaRoomSettings {
  const room = snapshot.room;
  return {
    name: room.name,
    maxPlayers: room.max_players,
    isPrivate: room.is_private,
    videoEnabled: room.video_enabled,
    cameraRequired: room.camera_required,
    autoPhase: room.auto_phase,
    chatEnabled: room.chat_enabled,
    deadChatEnabled: room.dead_chat_enabled,
    deadCanObserve: room.dead_can_observe,
    deadCanReadAliveChat: room.dead_can_read_alive_chat,
    nightSeconds: room.settings.nightSeconds,
    discussionSeconds: room.settings.discussionSeconds,
    votingSeconds: room.settings.votingSeconds,
    roles: room.settings.roles,
    roleAssignmentMode: room.settings.roleAssignmentMode ?? "random",
    allowVoteChange: room.settings.allowVoteChange,
    tieRule: room.settings.tieRule,
  };
}
