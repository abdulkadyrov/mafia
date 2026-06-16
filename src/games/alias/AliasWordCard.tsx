import type { AliasWord } from "./aliasTypes";

export function AliasWordCard({ word }: { word: AliasWord | null }) {
  return (
    <div className="grid h-full place-items-center rounded-3xl border border-white/10 bg-white/5 p-8">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/80">
          Слово
        </p>
        <h2 className="mt-5 text-4xl font-black text-white sm:text-6xl">
          {word?.text ?? "Нет слова"}
        </h2>
        {word ? (
          <p className="mt-4 text-sm font-semibold text-white/65">
            {word.category} · {word.difficulty}
          </p>
        ) : null}
      </div>
    </div>
  );
}

