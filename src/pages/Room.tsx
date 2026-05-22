import React from 'react'

type Props = {
  onLeave: () => void
}

export const Room: React.FC<Props> = ({ onLeave }) => {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Комната</h1>
        <button className="text-sm text-[#9CA3AF]" onClick={onLeave}>
          Выйти
        </button>
      </header>

      <section className="space-y-4">
        <div className="bg-[#111827] rounded-xl p-6 shadow-md">
          <h2 className="text-lg">Код комнаты</h2>
          <div className="mt-3 text-2xl font-mono">ABCD-92</div>
        </div>

        <div className="bg-[#111827] rounded-xl p-6 shadow-md">
          <h3 className="mb-2">Игроки</h3>
          <ul className="space-y-2 text-sm text-[#9CA3AF]">
            <li>Тимур — жив</li>
            <li>Лёха — жив</li>
          </ul>
        </div>
      </section>
    </main>
  )
}
