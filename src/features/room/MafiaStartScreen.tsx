import React from "react";
import { MafiaBackground } from "../../core/ui/MafiaBackground";
import { routes } from "../../core/config/routes";
import { createMafiaRoom, joinMafiaRoom, normalizeMafiaRoomCode } from "../../core/room/mafiaRoomService";
import type { MafiaRoomSettings } from "../../core/room/mafiaRoomTypes";
import { changeHostParticipation, changePlayerLimit, changeRoleCount } from "./roleSettings";

const defaultSettings: MafiaRoomSettings = {
  name: "Вечерняя мафия",
  maxPlayers: 7,
  isPrivate: true,
  videoEnabled: true,
  cameraRequired: false,
  autoPhase: false,
  chatEnabled: true,
  deadChatEnabled: true,
  deadCanObserve: true,
  deadCanReadAliveChat: false,
  nightSeconds: 45,
  discussionSeconds: 180,
  votingSeconds: 45,
  roles: { mafia: 2, don: 0, doctor: 1, commissioner: 1, maniac: 0, mistress: 0, bodyguard: 0, civilian: 3 },
  roleAssignmentMode: "random",
  hostPlays: true,
  allowVoteChange: false,
  tieRule: "no_execution",
};

export function MafiaStartScreen({ navigate }: { navigate: (path: string) => void }) {
  const [mode, setMode] = React.useState<"create" | "join">(() => location.hash.includes("join=1") ? "join" : "create");
  const [settings, setSettings] = React.useState(defaultSettings);
  const [code, setCode] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit() {
    setIsSubmitting(true);
    setError("");
    try {
      const snapshot = mode === "create" ? await createMafiaRoom(settings) : await joinMafiaRoom(code);
      navigate(routes.game(snapshot.room.code, "mafia"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось открыть комнату");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mafia-page mafia-create-page">
      <MafiaBackground name="create" />
      <section className="mafia-dialog-shell">
        <header className="mafia-dialog-header">
          <button className="mafia-icon-button" onClick={() => navigate(routes.home)} aria-label="Назад">←</button>
          <div><span className="mafia-eyebrow">Подготовка</span><h1>{mode === "create" ? "Настройки комнаты" : "Войти в комнату"}</h1></div>
        </header>
        <div className="mafia-segmented" role="tablist">
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Создать</button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>Войти по коду</button>
        </div>

        {mode === "create" ? (
          <div className="mafia-settings-layout">
            <section className="mafia-settings-form">
              <Field label="Название комнаты">
                <input value={settings.name} maxLength={48} onChange={(event) => setSettings({ ...settings, name: event.target.value })} />
              </Field>
              <div className="mafia-two-columns">
                <Field label="Количество игроков">
                  <select value={settings.maxPlayers} onChange={(event) => setSettings(changePlayerLimit(settings, Number(event.target.value)))}>
                    {Array.from({ length: 11 }, (_, index) => index + 6).map((count) => <option key={count}>{count}</option>)}
                  </select>
                </Field>
                <Field label="Управление фазами">
                  <select value={settings.autoPhase ? "auto" : "manual"} onChange={(event) => setSettings({ ...settings, autoPhase: event.target.value === "auto" })}>
                    <option value="manual">Вручную</option><option value="auto">По таймеру</option>
                  </select>
                </Field>
              </div>
              <div className="mafia-role-counters">
                <RoleCounter label="Мафия" value={Number(settings.roles.mafia ?? 0)} onChange={(value) => updateRole("mafia", value)} />
                <RoleCounter label="Дон" value={Number(settings.roles.don ?? 0)} onChange={(value) => updateRole("don", value)} />
                <RoleCounter label="Доктор" value={Number(settings.roles.doctor ?? 0)} onChange={(value) => updateRole("doctor", value)} />
                <RoleCounter label="Комиссар" value={Number(settings.roles.commissioner ?? 0)} onChange={(value) => updateRole("commissioner", value)} />
                <RoleCounter label="Маньяк" value={Number(settings.roles.maniac ?? 0)} onChange={(value) => updateRole("maniac", value)} />
                <RoleCounter label="Любовница" value={Number(settings.roles.mistress ?? 0)} onChange={(value) => updateRole("mistress", value)} />
                <RoleCounter label="Телохранитель" value={Number(settings.roles.bodyguard ?? 0)} onChange={(value) => updateRole("bodyguard", value)} />
                <RoleCounter label="Мирные" value={Number(settings.roles.civilian ?? 0)} onChange={(value) => updateRole("civilian", value)} />
              </div>
              <div className="mafia-toggle-grid">
                <Toggle label="Приватная комната" checked={settings.isPrivate} onChange={(value) => setSettings({ ...settings, isPrivate: value })} />
                <Toggle label="Видеосвязь" checked={settings.videoEnabled} onChange={(value) => setSettings({ ...settings, videoEnabled: value })} />
                <Toggle label="Камера обязательна" checked={settings.cameraRequired} onChange={(value) => setSettings({ ...settings, cameraRequired: value })} />
                <Toggle label="Игровой чат" checked={settings.chatEnabled} onChange={(value) => setSettings({ ...settings, chatEnabled: value })} />
                <Toggle label="Роли назначает ведущий" checked={settings.roleAssignmentMode === "manual"} onChange={(value) => setSettings({ ...settings, roleAssignmentMode: value ? "manual" : "random" })} />
                <Toggle label="Ведущий участвует в игре" checked={settings.hostPlays} onChange={(value) => setSettings(changeHostParticipation(settings, value))} />
                <Toggle label="Чат погибших" checked={settings.deadChatEnabled} onChange={(value) => setSettings({ ...settings, deadChatEnabled: value })} />
                <Toggle label="Наблюдение после смерти" checked={settings.deadCanObserve} onChange={(value) => setSettings({ ...settings, deadCanObserve: value })} />
                <Toggle label="Погибшие читают чат живых" checked={settings.deadCanReadAliveChat} onChange={(value) => setSettings({ ...settings, deadCanReadAliveChat: value })} />
              </div>
              <details className="mafia-advanced-settings">
                <summary>Таймеры и дополнительные правила</summary>
                <div className="mafia-three-columns">
                  <NumberInput label="Ночь" value={settings.nightSeconds} onChange={(value) => setSettings({ ...settings, nightSeconds: value })} />
                  <NumberInput label="Обсуждение" value={settings.discussionSeconds} onChange={(value) => setSettings({ ...settings, discussionSeconds: value })} />
                  <NumberInput label="Голосование" value={settings.votingSeconds} onChange={(value) => setSettings({ ...settings, votingSeconds: value })} />
                </div>
                <div className="mafia-two-columns">
                  <Toggle label="Разрешить смену голоса" checked={settings.allowVoteChange} onChange={(value) => setSettings({ ...settings, allowVoteChange: value })} />
                  <Field label="При ничьей"><select value={settings.tieRule} onChange={(event) => setSettings({ ...settings, tieRule: event.target.value as MafiaRoomSettings["tieRule"] })}><option value="no_execution">Никого не исключать</option><option value="revote">Повторить голосование</option></select></Field>
                </div>
              </details>
            </section>
          </div>
        ) : (
          <section className="mafia-join-panel">
            <div className="mafia-code-emblem">#</div>
            <h2>Код приглашения</h2>
            <p>Введите шесть символов из приглашения ведущего.</p>
            <input
              autoFocus
              className="mafia-room-code-input"
              value={code}
              maxLength={6}
              onChange={(event) => setCode(normalizeMafiaRoomCode(event.target.value))}
              onKeyDown={(event) => { if (event.key === "Enter" && code.length === 6) void submit(); }}
              placeholder="A1B2C3"
            />
          </section>
        )}

        {error ? <div className="mafia-form-error" role="alert">{error}</div> : null}
        <button className="mafia-primary-button mafia-submit-room" disabled={isSubmitting || (mode === "join" && code.length !== 6)} onClick={() => void submit()}>
          {isSubmitting ? "Подключаем…" : mode === "create" ? "Создать комнату" : "Войти в комнату"}
        </button>
      </section>
    </main>
  );

  function updateRole(role: keyof MafiaRoomSettings["roles"], value: number) {
    setSettings(changeRoleCount(settings, role, value));
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mafia-field"><span>{label}</span>{children}</label>;
}

function RoleCounter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="mafia-role-counter"><span>{label}</span><div><button type="button" onClick={() => onChange(value - 1)} aria-label={`Уменьшить ${label}`}>−</button><strong>{value}</strong><button type="button" onClick={() => onChange(value + 1)} aria-label={`Увеличить ${label}`}>+</button></div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="mafia-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={`${label}, сек`}><input type="number" min={15} max={900} value={value} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
}
