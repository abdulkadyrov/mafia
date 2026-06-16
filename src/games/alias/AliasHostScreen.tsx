import { AliasControlPanel } from "./AliasControlPanel";
import { AliasTimer } from "./AliasTimer";
import { AliasWordCard } from "./AliasWordCard";
import type { AliasWord } from "./aliasTypes";

export function AliasHostScreen({ word }: { word: AliasWord | null }) {
  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <AliasWordCard word={word} />
      <div className="grid gap-4">
        <AliasTimer seconds={60} />
        <AliasControlPanel />
      </div>
    </div>
  );
}

