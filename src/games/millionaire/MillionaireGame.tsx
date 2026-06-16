import { ResponsiveGameFrame } from "../../core/layout/ResponsiveGameFrame";
import { AppLayout } from "../../core/layout/AppLayout";
import { Card } from "../../core/ui/Card";
import { getInitialMillionaireQuestion } from "./millionaireEngine";
import { MillionaireHostScreen } from "./MillionaireHostScreen";
import { validateMillionairePack } from "./millionairePackValidator";

const defaultPackJson = JSON.stringify(
  {
    game: "millionaire",
    title: "Демо-викторина",
    description: "Стартовый пакет",
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      allowImages: true,
    },
    questions: [
      {
        id: "q1",
        level: 1,
        points: 100,
        question: "Какой город является столицей Чеченской Республики?",
        image: null,
        options: [
          { id: "a", text: "Грозный" },
          { id: "b", text: "Аргун" },
          { id: "c", text: "Шали" },
          { id: "d", text: "Гудермес" },
        ],
        correctOptionId: "a",
        explanation: "Столица Чеченской Республики — город Грозный.",
      },
    ],
  },
  null,
  2
);

export function MillionaireGame({ roomCode }: { roomCode: string }) {
  const validation = validateMillionairePack(defaultPackJson);
  const question = validation.pack
    ? getInitialMillionaireQuestion(validation.pack)
    : null;

  return (
    <AppLayout
      title="Кто хочет стать миллионером"
      subtitle={`Комната ${roomCode}`}
    >
      <ResponsiveGameFrame>
        <div className="grid h-full gap-4">
          {validation.errors.length > 0 ? (
            <Card className="text-red-100">
              {validation.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </Card>
          ) : (
            <MillionaireHostScreen question={question} />
          )}
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}

