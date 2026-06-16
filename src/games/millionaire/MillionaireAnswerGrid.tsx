import type { MillionaireQuestion } from "./millionaireTypes";

export function MillionaireAnswerGrid({
  question,
}: {
  question: MillionaireQuestion | null;
}) {
  if (!question) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {question.options.map((option) => (
        <div
          key={option.id}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold text-white"
        >
          <span className="text-amber-200">{option.id.toUpperCase()}.</span>{" "}
          {option.text}
        </div>
      ))}
    </div>
  );
}

