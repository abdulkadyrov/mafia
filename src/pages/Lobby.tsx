import React from 'react'
import { motion } from 'framer-motion'
import { defaultRoomSettings } from '../game/defaults'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { generateRoomCode } from '../network/RoomService'
import { RoomSettingsForm } from '../features/room-settings/RoomSettingsForm'
import { Button } from '../shared/ui/Button'
import { Panel } from '../shared/ui/Panel'
import { LogoMark } from '../widgets/LogoMark'
import { RoomSettings } from '../types/game'

type Props = {
  onCreateRoom: (roomCode: string, settings: RoomSettings, developerMode: boolean) => void
  onJoinRoom: (roomCode: string) => void
}

export const Lobby: React.FC<Props> = ({ onCreateRoom, onJoinRoom }) => {
  const developerMode = useDeveloperMode()
  const [settings, setSettings] = useLocalStorage<RoomSettings>('mafia-room-settings', defaultRoomSettings)
  const [joinCode, setJoinCode] = React.useState('')
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <LogoMark onPress={developerMode.registerTap} />
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-muted">
          Offline ready
        </span>
      </header>

      <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: 'blur(12px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="space-y-6"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">Host-authoritative</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-black leading-tight text-text sm:text-6xl">Mafia</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">
              Локальная автоматическая партия для телефонов и ПК: общий Wi-Fi, hotspot, QR-приглашение и PWA-режим.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="primary"
              className="h-14 text-base"
              onClick={() => onCreateRoom(generateRoomCode(), settings, developerMode.enabled)}
            >
              Создать комнату
            </Button>
            <Button className="h-14 text-base" onClick={() => setSettingsOpen((value) => !value)}>
              Настройки
            </Button>
          </div>

          <Panel>
            <h2 className="text-lg font-semibold text-text">Войти</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABCD-92"
                className="h-14 flex-1 rounded-xl border border-white/10 bg-background px-4 font-mono text-base text-text outline-none transition focus:border-accent"
              />
              <Button disabled={!joinCode.trim()} onClick={() => onJoinRoom(joinCode.trim())}>
                Войти
              </Button>
            </div>
          </Panel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, filter: 'blur(12px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
        >
          {settingsOpen ? (
            <RoomSettingsForm settings={settings} onChange={setSettings} />
          ) : (
            <Panel className="min-h-[460px]">
              <div className="grid h-full gap-5">
                <div>
                  <h2 className="text-2xl font-black text-text">Новая партия</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Роли, таймеры, ставки и приватность комнаты готовы до старта. Хост остается единственным источником
                    истины.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Игроки" value={settings.playerLimit} />
                  <Metric label="Мафия" value={settings.roles.mafia} />
                  <Metric label="Ночь" value={`${settings.timers.nightSeconds}с`} />
                  <Metric label="Голосование" value={`${settings.timers.votingSeconds}с`} />
                </div>
                <div className="rounded-xl border border-white/10 bg-card/70 p-4">
                  <p className="text-sm font-medium text-text">Локальный discovery</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Комнаты, созданные на этом устройстве, сохраняются локально. Для подключения используйте QR или код
                    комнаты.
                  </p>
                </div>
                {developerMode.enabled ? (
                  <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm font-semibold text-text">
                    Hidden Developer Mode активирован
                  </div>
                ) : null}
              </div>
            </Panel>
          )}
        </motion.div>
      </section>

      <nav className="grid grid-cols-3 gap-2 pb-4">
        <Button variant="ghost">Профиль</Button>
        <Button variant="ghost">История</Button>
        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
          Настройки
        </Button>
      </nav>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card/70 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-text">{value}</p>
    </div>
  )
}
