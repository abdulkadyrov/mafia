import { AppLayout } from "../../core/layout/AppLayout";
import { ResponsiveGameFrame } from "../../core/layout/ResponsiveGameFrame";
import { Card } from "../../core/ui/Card";
import { getInitialAliasWord } from "./aliasEngine";
import { AliasHostScreen } from "./AliasHostScreen";
import { validateAliasPack } from "./aliasPackValidator";

const defaultPackJson = JSON.stringify(
  {
    game: "alias",
    title: "Общие слова",
    description: "Стандартный набор слов",
    settings: {
      roundTimeSec: 60,
      pointsCorrect: 1,
      pointsMistake: -1,
      allowSkip: true,
      shuffleWords: true,
    },
    words: [
      {
        id: "w1",
        text: "Телефон",
        difficulty: "easy",
        category: "Быт",
      },
    ],
  },
  null,
  2
);

export function AliasGame({ roomCode }: { roomCode: string }) {
  const validation = validateAliasPack(defaultPackJson);
  const word = validation.pack ? getInitialAliasWord(validation.pack) : null;

  return (
    <AppLayout title="Alias" subtitle={`Комната ${roomCode}`}>
      <ResponsiveGameFrame>
        <div className="grid h-full gap-4">
          {validation.errors.length > 0 ? (
            <Card className="text-red-100">
              {validation.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </Card>
          ) : (
            <AliasHostScreen word={word} />
          )}
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}

