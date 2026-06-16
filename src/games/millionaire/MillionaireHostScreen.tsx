import { MillionaireAnswerGrid } from "./MillionaireAnswerGrid";
import { MillionaireControlPanel } from "./MillionaireControlPanel";
import { MillionaireQuestionView } from "./MillionaireQuestionView";
import { MillionaireScorePanel } from "./MillionaireScorePanel";
import type { MillionaireQuestion } from "./millionaireTypes";

export function MillionaireHostScreen({
  question,
}: {
  question: MillionaireQuestion | null;
}) {
  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <MillionaireQuestionView question={question} />
        <MillionaireAnswerGrid question={question} />
      </div>
      <div className="grid gap-4">
        <MillionaireScorePanel />
        <MillionaireControlPanel />
      </div>
    </div>
  );
}

