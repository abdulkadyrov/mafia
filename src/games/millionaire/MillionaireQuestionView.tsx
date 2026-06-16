import type { MillionaireQuestion } from "./millionaireTypes";

export function MillionaireQuestionView({
  question,
}: {
  question: MillionaireQuestion | null;
}) {
  if (!question) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        Пак не выбран или не содержит вопросов.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">
        Вопрос · {question.points} очков
      </p>
      <h2 className="mt-4 text-2xl font-black text-white">{question.question}</h2>
      {question.image ? (
        <img
          src={question.image}
          alt={question.question}
          className="mt-5 h-56 w-full rounded-2xl object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}

