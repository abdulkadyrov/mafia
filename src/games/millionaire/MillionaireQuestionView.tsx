import type { MillionaireQuestion } from "./millionaireTypes";

export function MillionaireQuestionView({
  question,
  questionNumber,
  questionCount,
  prizeLabel,
  guaranteeLabel,
  timerLabel,
}: {
  question: MillionaireQuestion | null;
  questionNumber?: number;
  questionCount?: number;
  prizeLabel?: string;
  guaranteeLabel?: string;
  timerLabel?: string;
}) {
  if (!question) {
    return (
      <div className="millionaire-panel text-white/70">
        Пак не выбран или не содержит вопросов.
      </div>
    );
  }

  return (
    <div className="millionaire-question-panel">
      <div className="millionaire-pills">
        <div className="millionaire-pill">
          Вопрос:{" "}
          <strong>
            {questionNumber && questionCount
              ? `${questionNumber}/${questionCount}`
              : "1/1"}
          </strong>
        </div>
        <div className="millionaire-pill">
          За вопрос: <strong>{prizeLabel ?? `${question.points} очков`}</strong>
        </div>
        <div className="millionaire-pill">
          Несгораемая: <strong>{guaranteeLabel ?? "0"}</strong>
        </div>
        <div className="millionaire-pill">
          Время: <strong>{timerLabel ?? "—"}</strong>
        </div>
      </div>
      <hr className="border-white/10" />
      <h2 className="millionaire-question-text">{question.question}</h2>
      {question.image ? (
        <img
          src={question.image}
          alt={question.question}
          className="millionaire-question-image"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}
