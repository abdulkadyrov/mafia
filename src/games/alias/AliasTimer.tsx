export function AliasTimer({ seconds }: { seconds: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
        Таймер
      </p>
      <p className="mt-2 text-4xl font-black text-white">{seconds}s</p>
    </div>
  );
}

