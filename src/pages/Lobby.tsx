import React from 'react'

type Props = {
  onCreateRoom: () => void
}

export const Lobby: React.FC<Props> = ({ onCreateRoom }) => {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">Mafia</h1>
        <div className="text-sm text-muted">LAN PWA</div>
      </header>

      <section className="space-y-4">
        <div className="bg-[#111827] rounded-xl p-6 shadow-md">
          <h2 className="text-xl mb-4">Создать комнату</h2>
          <p className="text-sm text-[#9CA3AF] mb-4">Настройки комнаты в будущем</p>
          <button
            className="px-5 py-3 bg-[#8B5CF6] rounded-xl shadow hover:opacity-90"
            onClick={onCreateRoom}
          >
            Создать комнату
          </button>
        </div>

        <div className="flex gap-3">
          <button className="flex-1 px-4 py-3 bg-[#111827] rounded-xl">Войти</button>
          <button className="px-4 py-3 bg-transparent border border-[#374151] rounded-xl">QR</button>
        </div>
      </section>

      <nav className="fixed bottom-6 left-0 right-0 max-w-3xl mx-auto flex justify-between px-6">
        <button className="bg-transparent text-sm">Профиль</button>
        <button className="bg-transparent text-sm">История</button>
        <button className="bg-transparent text-sm">Настройки</button>
      </nav>
    </main>
  )
}
