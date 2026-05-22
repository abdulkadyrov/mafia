import { NumberField } from '../../shared/ui/NumberField'
import { Panel } from '../../shared/ui/Panel'
import { Toggle } from '../../shared/ui/Toggle'
import { RoomSettings } from '../../types/game'

type RoomSettingsFormProps = {
  settings: RoomSettings
  onChange: (settings: RoomSettings) => void
}

export function RoomSettingsForm({ settings, onChange }: RoomSettingsFormProps) {
  function updateSettings(patch: Partial<RoomSettings>) {
    onChange({
      ...settings,
      ...patch
    })
  }

  function updateRoles(patch: Partial<RoomSettings['roles']>) {
    updateSettings({
      roles: {
        ...settings.roles,
        ...patch
      }
    })
  }

  function updateTimers(patch: Partial<RoomSettings['timers']>) {
    updateSettings({
      timers: {
        ...settings.timers,
        ...patch
      }
    })
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text">Игроки</h2>
          <p className="mt-1 text-sm text-muted">Состав и роли синхронизируются хостом.</p>
        </div>
        <NumberField
          label="Количество игроков"
          min={4}
          max={16}
          value={settings.playerLimit}
          onChange={(playerLimit) => updateSettings({ playerLimit })}
        />
      </Panel>

      <Panel>
        <h2 className="mb-4 text-lg font-semibold text-text">Роли</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Мафия" min={1} max={6} value={settings.roles.mafia} onChange={(mafia) => updateRoles({ mafia })} />
          <NumberField
            label="Доктор"
            min={0}
            max={4}
            value={settings.roles.doctors}
            onChange={(doctors) => updateRoles({ doctors })}
          />
          <NumberField
            label="Детектив"
            min={0}
            max={4}
            value={settings.roles.detectives}
            onChange={(detectives) => updateRoles({ detectives })}
          />
          <NumberField
            label="Мирные"
            min={0}
            max={12}
            value={settings.roles.civilians}
            onChange={(civilians) => updateRoles({ civilians })}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 text-lg font-semibold text-text">Таймеры</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Ночь"
            suffix="сек"
            min={15}
            max={180}
            value={settings.timers.nightSeconds}
            onChange={(nightSeconds) => updateTimers({ nightSeconds })}
          />
          <NumberField
            label="Обсуждение"
            suffix="сек"
            min={30}
            max={600}
            value={settings.timers.discussionSeconds}
            onChange={(discussionSeconds) => updateTimers({ discussionSeconds })}
          />
          <NumberField
            label="Голосование"
            suffix="сек"
            min={15}
            max={180}
            value={settings.timers.votingSeconds}
            onChange={(votingSeconds) => updateTimers({ votingSeconds })}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 text-lg font-semibold text-text">Дополнительно</h2>
        <div className="grid gap-3">
          <Toggle
            label="Показывать роли после смерти"
            checked={settings.revealRolesAfterDeath}
            onChange={(revealRolesAfterDeath) => updateSettings({ revealRolesAfterDeath })}
          />
          <Toggle
            label="Показывать историю действий"
            checked={settings.showActionHistory}
            onChange={(showActionHistory) => updateSettings({ showActionHistory })}
          />
          <Toggle
            label="Режим ставок"
            checked={settings.bettingMode}
            onChange={(bettingMode) => updateSettings({ bettingMode })}
          />
          <Toggle
            label="Private room"
            checked={settings.privateRoom}
            onChange={(privateRoom) => updateSettings({ privateRoom })}
          />
          <Toggle
            label="Auto-start"
            checked={settings.autoStart}
            onChange={(autoStart) => updateSettings({ autoStart })}
          />
        </div>
      </Panel>
    </div>
  )
}
