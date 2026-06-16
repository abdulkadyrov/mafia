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
import { MillionaireAnswerGrid } from "./MillionaireAnswerGrid";
import { MillionaireHostScreen } from "./MillionaireHostScreen";
import { MillionaireQuestionView } from "./MillionaireQuestionView";
import { MillionaireTeamScreen } from "./MillionaireTeamScreen";
import { millionaireSounds } from "./millionaireSounds";
import type { MillionairePack, MillionaireQuestion, MillionaireState } from "./millionaireTypes";
import { QrCodeCard } from "../../core/qr/QrCodeCard";
import { routes } from "../../core/config/routes";
import { getLocalGamePacksByType } from "../../core/packs/localPackLibrary";
import { clearSession } from "../../utils/storage";
import { createHashAppPath } from "../../shared/routing/basePath";

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
    setupMode: "teams",
    setupStep: "teams",
    selectedPackId: null,
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

    void getGamePacksByType(room.id, "millionaire").then((records) => {
      const roomPacks = records.map((record) => ({
        id: record.id,
        title: record.title,
        content: record.content as MillionairePack,
      }));
      const localPacks = getLocalGamePacksByType("millionaire").map((record) => ({
        id: `local-${record.id}`,
        title: record.title,
        content: record.content as MillionairePack,
      }));
      setPacks([
        { id: "builtin-millionaire", title: BUILTIN_PACK.title, content: BUILTIN_PACK },
        ...localPacks,
        ...roomPacks,
      ]);
    });
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
  const teamJoinBaseUrl = `${window.location.origin}${import.meta.env.BASE_URL}#`;

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

  async function changeSetupMode(mode: MillionaireState["setupMode"]) {
    await syncQuestionPhase({
      ...createInitialMillionaireState(),
      setupMode: mode,
      setupStep: "teams",
      selectedPackId: state.selectedPackId,
    });
  }

  async function changeSelectedPack(packId: string) {
    await syncQuestionPhase({
      ...state,
      selectedPackId: packId,
      setupStep: "pack",
      phase: "setup",
      questionIndex: 0,
      showOptions: false,
      buzzedTeamId: null,
      wrongTeamIds: [],
      results: [],
      lastCorrectTeamId: null,
    });
  }

  async function continueToPackSelection() {
    await syncQuestionPhase({
      ...state,
      setupStep: "pack",
      phase: "setup",
    });
  }

  async function continueToGameplay() {
    await syncQuestionPhase({
      ...state,
      setupStep: "play",
      selectedPackId: state.selectedPackId ?? packs[0]?.id ?? "builtin-millionaire",
      phase: "setup",
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
    const effectiveTeamId =
      state.buzzedTeamId ?? (state.setupMode === "single" ? "single-device" : null);

    if (!room?.id || !effectiveTeamId || !question) {
      return;
    }

    await playSfx("correctHard");
    await applyScoreDelta({
      roomId: room.id,
      teamId: effectiveTeamId,
      delta: question.points,
      reason: `Вопрос ${question.id}`,
    });

    await syncQuestionPhase({
      ...state,
      phase: "resolved",
      lastCorrectTeamId: effectiveTeamId,
      results: [
        ...state.results,
        {
          questionId: question.id,
          teamId: effectiveTeamId,
          result: "correct",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  async function handleMarkWrong() {
    const effectiveTeamId =
      state.buzzedTeamId ?? (state.setupMode === "single" ? "single-device" : null);

    if (!effectiveTeamId || !question) {
      return;
    }

    await playSfx("wrong");
    const nextWrongTeamIds = [...new Set([...state.wrongTeamIds, effectiveTeamId])];
    const everyoneTried = teams.length > 0 && nextWrongTeamIds.length >= teams.length;

    await syncQuestionPhase({
      ...state,
      phase: state.setupMode === "single" || everyoneTried ? "resolved" : "question",
      buzzedTeamId: null,
      wrongTeamIds: nextWrongTeamIds,
      results: [
        ...state.results,
        {
          questionId: question.id,
          teamId: effectiveTeamId,
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

  function leaveGame() {
    clearSession();
    history.replaceState(null, "", createHashAppPath(routes.gamesHub));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  if (isLoading || teamsLoading) {
    return <AppLayout title="Кто хочет стать миллионером">Загрузка...</AppLayout>;
  }

  return (
    <AppLayout
      title="Кто хочет стать миллионером"
      subtitle={`Комната ${roomCode}`}
      backPath={routes.games(roomCode)}
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
          <Button variant="ghost" onClick={leaveGame}>
            Выйти в главное меню
          </Button>
        </>
      }
    >
      <ResponsiveGameFrame>
        <div className="grid h-full gap-4">
          {isHost && state.setupStep === "teams" ? (
            <>
              <Card>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Режим игры
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant={state.setupMode === "teams" ? "primary" : "secondary"}
                    onClick={() => {
                      void changeSetupMode("teams");
                    }}
                  >
                    Команды и QR
                  </Button>
                  <Button
                    variant={state.setupMode === "single" ? "primary" : "secondary"}
                    onClick={() => {
                      void changeSetupMode("single");
                    }}
                  >
                    Один экран
                  </Button>
                </div>
              </Card>

              {state.setupMode === "teams" ? <TeamManager /> : null}
              {state.setupMode === "single" ? (
                <Card>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                    Шаг 1
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Игра на одном телефоне
                  </h3>
                  <p className="mt-3 text-sm font-semibold text-white/70">
                    Этот режим не требует команд и QR. Ведущий показывает вопрос,
                    игроки отвечают вслух, а вы отмечаете правильный или неверный ответ.
                  </p>
                  <div className="mt-5">
                    <Button
                      variant="primary"
                      onClick={() => {
                        void continueToPackSelection();
                      }}
                    >
                      Продолжить
                    </Button>
                  </div>
                </Card>
              ) : teams.length > 0 ? (
                <Card>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                    Шаг 1
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Команды и вход по QR
                  </h3>
                  <p className="mt-3 text-sm font-semibold text-white/70">
                    Сначала создайте команды и дайте игрокам зайти строго в свои команды.
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {teams.map((team) => (
                      <QrCodeCard
                        key={team.id}
                        title={`QR команды ${team.name}`}
                        value={`${teamJoinBaseUrl}${routes.gameJoin(
                          "millionaire",
                          roomCode,
                          team.id
                        )}`}
                      />
                    ))}
                  </div>
                  <div className="mt-5">
                    <Button
                      variant="primary"
                      disabled={teams.length === 0}
                      onClick={() => {
                        void continueToPackSelection();
                      }}
                    >
                      Продолжить
                    </Button>
                  </div>
                </Card>
              ) : null}
            </>
          ) : isHost && state.setupStep === "pack" ? (
            <Card>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                Шаг 2
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Выбор темы викторины
              </h3>
              <p className="mt-3 text-sm font-semibold text-white/70">
                Темы берутся из сохранённых JSON-паков из раздела настроек.
              </p>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Тема / пакет
                </span>
                <select
                  value={state.selectedPackId ?? packs[0]?.id ?? ""}
                  onChange={(event) => {
                    void changeSelectedPack(event.target.value);
                  }}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
                >
                  {packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-lg font-black text-white">{selectedPack.title}</p>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  {selectedPack.description}
                </p>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  Вопросов: {selectedPack.questions.length}
                </p>
              </div>
              <div className="mt-5">
                <Button variant="primary" onClick={() => void continueToGameplay()}>
                  Продолжить
                </Button>
              </div>
            </Card>
          ) : isHost && state.setupMode === "single" ? (
            <div className="grid h-full gap-4">
              <MillionaireQuestionView question={question} />
              {state.showOptions ? (
                <MillionaireAnswerGrid question={question} />
              ) : (
                <Card className="text-white/72">Варианты ответа пока скрыты.</Card>
              )}
              <Card>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Один экран
                </p>
                <p className="mt-3 text-sm font-semibold text-white/70">
                  Тема: {selectedPack.title}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button variant="primary" onClick={() => void handleStartQuestion()}>
                    Начать вопрос
                  </Button>
                  <Button onClick={() => void handleShowOptions()}>
                    Показать варианты
                  </Button>
                  <Button onClick={() => void handleMarkCorrect()} disabled={!question}>
                    Правильный ответ
                  </Button>
                  <Button onClick={() => void handleMarkWrong()} disabled={!question}>
                    Неправильный ответ
                  </Button>
                  <Button onClick={() => void handleNextQuestion()}>Следующий вопрос</Button>
                  <Button variant="ghost" onClick={() => void handleEndGame()}>
                    Завершить игру
                  </Button>
                </div>
              </Card>
            </div>
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
            state.setupStep !== "play" ? (
              <Card>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Подготовка
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">
                  {currentTeam?.name ?? "Ожидание команды"}
                </h3>
                <p className="mt-3 text-sm font-semibold text-white/72">
                  Ведущий собирает команды и выбирает тему игры. После этого вы сразу
                  перейдёте к викторине.
                </p>
              </Card>
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
            )
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

          {isHost && state.setupStep === "play" ? null : null}
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}
