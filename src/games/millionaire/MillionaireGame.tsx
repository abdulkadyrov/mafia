import React from "react";
import { useAudioController } from "../../core/audio/useAudioController";
import { AppLayout } from "../../core/layout/AppLayout";
import { ResponsiveGameFrame } from "../../core/layout/ResponsiveGameFrame";
import { getGamePacksByType } from "../../core/games/gameStateService";
import { useGameState } from "../../core/games/useGameState";
import { usePlayer } from "../../core/player/usePlayer";
import { useRoom } from "../../core/room/useRoom";
import { applyScoreDelta } from "../../core/score/scoreService";
import { ScoreBoard } from "../../core/score/ScoreBoard";
import { TeamManager } from "../../core/teams/TeamManager";
import { useTeams } from "../../core/teams/useTeams";
import { Card } from "../../core/ui/Card";
import { updateRoomMeta } from "../../core/room/roomService";
import { Button } from "../../core/ui/Button";
import { MillionaireHostScreen } from "./MillionaireHostScreen";
import { MillionaireTeamScreen } from "./MillionaireTeamScreen";
import { millionaireSounds } from "./millionaireSounds";
import type { MillionairePack, MillionaireQuestion, MillionaireState } from "./millionaireTypes";

const BUILTIN_PACK: MillionairePack = {
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
};

function createInitialMillionaireState(): MillionaireState {
  return {
    selectedPackId: "builtin-millionaire",
    questionIndex: 0,
    phase: "setup",
    showOptions: false,
    buzzedTeamId: null,
    wrongTeamIds: [],
    results: [],
    lastCorrectTeamId: null,
  };
}

export function MillionaireGame({ roomCode }: { roomCode: string }) {
  const { room } = useRoom();
  const { currentPlayer } = usePlayer();
  const { teams, members, isLoading: teamsLoading, refresh: refreshTeams } = useTeams();
  const { state, updateState, isLoading } = useGameState<MillionaireState>(
    "millionaire",
    createInitialMillionaireState
  );
  const [packs, setPacks] = React.useState<
    Array<{ id: string; title: string; content: MillionairePack }>
  >([{ id: "builtin-millionaire", title: BUILTIN_PACK.title, content: BUILTIN_PACK }]);
  const [manualTeamId, setManualTeamId] = React.useState("");
  const [manualDelta, setManualDelta] = React.useState(100);
  const {
    musicEnabled,
    sfxEnabled,
    setMusicEnabled,
    setSfxEnabled,
    playMusic,
    stopMusic,
    playSfx,
  } = useAudioController();

  const isHost = Boolean(currentPlayer?.is_host);
  const currentTeamId =
    members.find((member) => member.player_id === currentPlayer?.id)?.team_id ?? null;
  const currentTeam = teams.find((team) => team.id === currentTeamId) ?? null;

  React.useEffect(() => {
    if (room?.id) {
      void updateRoomMeta(room.id, {
        current_game: "millionaire",
        title: room.title ?? "Abdulkadyrov Games Room",
      });
    }
  }, [room?.id, room?.title]);

  React.useEffect(() => {
    if (!room?.id) {
      return;
    }

    const loadPacks = () =>
      getGamePacksByType(room.id, "millionaire").then((records) => {
        const importedPacks = records.map((record) => ({
          id: record.id,
          title: record.title,
          content: record.content as MillionairePack,
        }));
        setPacks([
          { id: "builtin-millionaire", title: BUILTIN_PACK.title, content: BUILTIN_PACK },
          ...importedPacks,
        ]);
      });

    void loadPacks();

    const intervalId = window.setInterval(() => {
      void loadPacks();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [room?.id]);

  React.useEffect(() => {
    if (!manualTeamId && teams[0]) {
      setManualTeamId(teams[0].id);
    }
  }, [manualTeamId, teams]);

  const selectedPack =
    packs.find((pack) => pack.id === state.selectedPackId)?.content ?? BUILTIN_PACK;
  const question = selectedPack.questions[state.questionIndex] ?? null;
  const canBuzz =
    Boolean(currentTeam) &&
    state.phase === "question" &&
    !state.buzzedTeamId &&
    !state.wrongTeamIds.includes(currentTeam?.id ?? "");

  React.useEffect(() => {
    if (state.phase === "question" || state.phase === "buzzed") {
      void playMusic("bgAudience");
      return;
    }

    stopMusic();
  }, [playMusic, state.phase, stopMusic]);

  async function syncQuestionPhase(nextState: MillionaireState) {
    await updateState(nextState);
    await refreshTeams();
  }

  async function changeSelectedPack(packId: string) {
    await syncQuestionPhase({
      ...createInitialMillionaireState(),
      selectedPackId: packId,
    });
  }

  async function handleStartQuestion() {
    await playSfx("firstQuestion");
    await syncQuestionPhase({
      ...state,
      phase: "question",
      showOptions: false,
      buzzedTeamId: null,
      wrongTeamIds: [],
    });
  }

  async function handleShowOptions() {
    await syncQuestionPhase({
      ...state,
      showOptions: true,
    });
  }

  async function handleBuzz(teamId: string) {
    if (!canBuzz) {
      return;
    }

    await playSfx("lockIn");
    await syncQuestionPhase({
      ...state,
      phase: "buzzed",
      buzzedTeamId: teamId,
    });
  }

  async function handleMarkCorrect() {
    if (!room?.id || !state.buzzedTeamId || !question) {
      return;
    }

    await playSfx("correctHard");
    await applyScoreDelta({
      roomId: room.id,
      teamId: state.buzzedTeamId,
      delta: question.points,
      reason: `Вопрос ${question.id}`,
    });

    await syncQuestionPhase({
      ...state,
      phase: "resolved",
      lastCorrectTeamId: state.buzzedTeamId,
      results: [
        ...state.results,
        {
          questionId: question.id,
          teamId: state.buzzedTeamId,
          result: "correct",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  async function handleMarkWrong() {
    if (!state.buzzedTeamId || !question) {
      return;
    }

    await playSfx("wrong");
    const nextWrongTeamIds = [...new Set([...state.wrongTeamIds, state.buzzedTeamId])];
    const everyoneTried = teams.length > 0 && nextWrongTeamIds.length >= teams.length;

    await syncQuestionPhase({
      ...state,
      phase: everyoneTried ? "resolved" : "question",
      buzzedTeamId: null,
      wrongTeamIds: nextWrongTeamIds,
      results: [
        ...state.results,
        {
          questionId: question.id,
          teamId: state.buzzedTeamId,
          result: "wrong",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  async function handleReopen() {
    await syncQuestionPhase({
      ...state,
      phase: "question",
      buzzedTeamId: null,
    });
  }

  async function handleNextQuestion() {
    await playSfx("nextQuestion");
    const nextQuestionIndex = Math.min(
      state.questionIndex + 1,
      Math.max(selectedPack.questions.length - 1, 0)
    );

    await syncQuestionPhase({
      ...state,
      questionIndex: nextQuestionIndex,
      phase: "setup",
      showOptions: false,
      buzzedTeamId: null,
      wrongTeamIds: [],
      lastCorrectTeamId: null,
    });
  }

  async function handleManualScore() {
    if (!room?.id || !manualTeamId || !manualDelta) {
      return;
    }

    await applyScoreDelta({
      roomId: room.id,
      teamId: manualTeamId,
      delta: manualDelta,
      reason: "Ручная корректировка ведущего",
    });
    await refreshTeams();
  }

  async function handleEndGame() {
    await syncQuestionPhase({
      ...state,
      phase: "finished",
    });
  }

  if (isLoading || teamsLoading) {
    return <AppLayout title="Кто хочет стать миллионером">Загрузка...</AppLayout>;
  }

  return (
    <AppLayout
      title="Кто хочет стать миллионером"
      subtitle={`Комната ${roomCode}`}
      actions={
        <>
          <Button
            variant={musicEnabled ? "secondary" : "ghost"}
            onClick={() => setMusicEnabled(!musicEnabled)}
          >
            {musicEnabled ? "Музыка: вкл" : "Музыка: выкл"}
          </Button>
          <Button
            variant={sfxEnabled ? "secondary" : "ghost"}
            onClick={() => setSfxEnabled(!sfxEnabled)}
          >
            {sfxEnabled ? "Звуки: вкл" : "Звуки: выкл"}
          </Button>
        </>
      }
    >
      <ResponsiveGameFrame>
        <div className="grid h-full gap-4">
          {teams.length === 0 ? (
            <TeamManager />
          ) : isHost ? (
            <MillionaireHostScreen
              teams={teams}
              state={state}
              question={question}
              selectedManualTeamId={manualTeamId}
              manualDelta={manualDelta}
              onSelectedManualTeamIdChange={setManualTeamId}
              onManualDeltaChange={setManualDelta}
              onChoosePack={changeSelectedPack}
              packOptions={packs.map((pack) => ({ id: pack.id, title: pack.title }))}
              onStartQuestion={handleStartQuestion}
              onShowOptions={handleShowOptions}
              onMarkCorrect={handleMarkCorrect}
              onMarkWrong={handleMarkWrong}
              onReopen={handleReopen}
              onNextQuestion={handleNextQuestion}
              onApplyManualScore={handleManualScore}
              onEndGame={handleEndGame}
            />
          ) : (
            <div className="grid h-full gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <MillionaireTeamScreen
                team={currentTeam}
                question={question}
                state={state}
                canBuzz={canBuzz}
                onBuzz={() => {
                  if (currentTeam) {
                    void handleBuzz(currentTeam.id);
                  }
                }}
              />
              <ScoreBoard teams={teams} />
            </div>
          )}

          {question ? (
            <Card className="text-white/78">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                Правильный ответ и объяснение
              </p>
              <p className="mt-3 font-bold text-white">
                {question.options.find((option) => option.id === question.correctOptionId)?.text}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/70">
                {question.explanation}
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#04101d] px-4 py-3 text-sm font-semibold text-white/72">
                Аудио Millionaire подключается здесь:
                <div className="mt-2 space-y-1 text-xs font-bold text-white/55">
                  <p>`firstQuestion` — старт вопроса</p>
                  <p>`lockIn` — команда нажала первой</p>
                  <p>`correctHard` — правильный ответ</p>
                  <p>`wrong` — неправильный ответ</p>
                  <p>`nextQuestion` — переход к следующему вопросу</p>
                  <p>`bgAudience` — фоновая музыка во время активного вопроса</p>
                </div>
                <p className="mt-2 text-xs font-semibold text-white/45">
                  Карта файлов лежит в [src/games/millionaire/millionaireSounds.ts].
                </p>
              </div>
            </Card>
          ) : null}
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}
