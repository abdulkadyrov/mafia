import React from 'react'
import { motion } from 'framer-motion'
import { defaultRoomSettings } from '../game/defaults'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { generateRoomCode } from '../network/RoomService'
import { Button } from '../shared/ui/Button'
import { LogoMark } from '../widgets/LogoMark'
import { RoomSettings } from '../types/game'

type Props = {
  onCreateRoom: (roomCode: string, settings: RoomSettings, developerMode: boolean, playerName: string) => void
  onJoinRoom: (roomCode: string, playerName: string) => void
}

export const Lobby: React.FC<Props> = ({ onCreateRoom, onJoinRoom }) => {
  const developerMode = useDeveloperMode()
  const [settings] = useLocalStorage<RoomSettings>('mafia-room-settings', defaultRoomSettings)
  const [playerName, setPlayerName] = useLocalStorage('mafia-player-name', '')
  const [joinCode, setJoinCode] = React.useState('')

  const cleanName = playerName.trim()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-6">
      <header className="flex items-center justify-between">
        <LogoMark onPress={developerMode.registerTap} />
      </header>

      <motion.section
        initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="space-y-4"
      >
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-muted">Имя</span>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Например, Тимур"
            className="h-14 w-full rounded-xl border border-white/10 bg-surface px-4 text-lg font-semibold text-text outline-none transition focus:border-accent"
          />
        </label>

        <Button
          variant="primary"
          className="h-14 w-full text-base"
          disabled={!cleanName}
          onClick={() => onCreateRoom(generateRoomCode(), settings, developerMode.enabled, cleanName)}
        >
          Создать комнату
        </Button>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="ABCD-92"
            className="h-14 min-w-0 rounded-xl border border-white/10 bg-surface px-4 font-mono text-lg font-semibold text-text outline-none transition focus:border-accent"
          />
          <Button disabled={!cleanName || !joinCode.trim()} onClick={() => onJoinRoom(joinCode.trim(), cleanName)}>
            Войти
          </Button>
        </div>
      </motion.section>

      <nav className="grid grid-cols-3 gap-2">
        <Button variant="ghost">Профиль</Button>
        <Button variant="ghost">История</Button>
        <Button variant="ghost">Настройки</Button>
      </nav>
    </main>
  )
}
