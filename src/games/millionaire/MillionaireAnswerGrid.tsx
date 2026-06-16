import type { MillionaireQuestion } from "./millionaireTypes";

export function MillionaireAnswerGrid({
  question,
  visibleCount = 4,
  disabledOptionIds = [],
  correctOptionId,
  wrongOptionId,
}: {
  question: MillionaireQuestion | null;
  visibleCount?: number;
  disabledOptionIds?: string[];
  correctOptionId?: string | null;
  wrongOptionId?: string | null;
}) {
  if (!question) {
    return null;
  }

  return (
    <div className="millionaire-answers">
      {question.options.map((option, index) => (
        <div
          key={option.id}
          className={[
            "millionaire-answer",
            index >= visibleCount ? "hidden" : "",
            disabledOptionIds.includes(option.id) ? "disabled" : "",
            correctOptionId === option.id ? "correct" : "",
            wrongOptionId === option.id ? "wrong" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="millionaire-answer-badge">{option.id.toUpperCase()}</div>
          <div className="millionaire-answer-text">{option.text}</div>
        </div>
      ))}
    </div>
  );
}
