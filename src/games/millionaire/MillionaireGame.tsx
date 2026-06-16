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
import "./millionaireClassic.css";
import type { MillionaireGameConfig } from "./millionaireTypes";

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
    preparedQuestions: [],
    gameConfig: {
      questionTime: 30,
      callTime: 45,
      answerRevealDelay: 0.6,
      questionCount: 0,
      safeLevels: [5, 10],
      shuffleQuestions: true,
      shuffleAnswers: true,
    },
    revealStartedAt: null,
    timerStartedAt: null,
    timerDurationSeconds: null,
  };
}

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeMillionaireState(input: MillionaireState): MillionaireState {
  const initialState = createInitialMillionaireState();

  return {
    ...initialState,
    ...input,
    preparedQuestions: input.preparedQuestions ?? initialState.preparedQuestions,
    gameConfig: {
      ...initialState.gameConfig,
      ...input.gameConfig,
      safeLevels: input.gameConfig?.safeLevels ?? initialState.gameConfig.safeLevels,
    },
    revealStartedAt: input.revealStartedAt ?? null,
    timerStartedAt: input.timerStartedAt ?? null,
    timerDurationSeconds: input.timerDurationSeconds ?? null,
  };
}

function formatRubles(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function buildPreparedQuestions(
  pack: MillionairePack,
  config: MillionaireGameConfig
): MillionaireQuestion[] {
  const requestedCount = Math.max(0, Number(config.questionCount || 0));
  let nextQuestions = [...pack.questions];

  if (config.shuffleQuestions) {
    nextQuestions = shuffleArray(nextQuestions);
  }

  if (requestedCount > 0) {
    nextQuestions = nextQuestions.slice(0, requestedCount);
  }

  return nextQuestions.slice(0, 15).map((question, questionIndex) => {
    const options = config.shuffleAnswers
      ? shuffleArray(question.options).map((option, optionIndex) => ({
          ...option,
          id: ["a", "b", "c", "d"][optionIndex] ?? option.id,
        }))
      : question.options.map((option, optionIndex) => ({
          ...option,
          id: ["a", "b", "c", "d"][optionIndex] ?? option.id,
        }));

    const correctOption = options.find(
      (option) =>
        option.text ===
        question.options.find((sourceOption) => sourceOption.id === question.correctOptionId)?.text
    );

    return {
      ...question,
      level: questionIndex + 1,
      options,
      correctOptionId: correctOption?.id ?? options[0]?.id ?? "a",
    };
  });
}

export function MillionaireGame({ roomCode }: { roomCode: string }) {
  const { room } = useRoom();
  const { currentPlayer } = usePlayer();
  const { teams, members, isLoading: teamsLoading, refresh: refreshTeams } = useTeams();
  const { state: rawState, updateState, isLoading } = useGameState<MillionaireState>(
    "millionaire",
    createInitialMillionaireState
  );
  const state = React.useMemo(() => normalizeMillionaireState(rawState), [rawState]);
  const [packs, setPacks] = React.useState<
    Array<{ id: string; title: string; content: MillionairePack }>
  >([{ id: "builtin-millionaire", title: BUILTIN_PACK.title, content: BUILTIN_PACK }]);
  const [draftConfig, setDraftConfig] = React.useState<MillionaireGameConfig>(
    createInitialMillionaireState().gameConfig
  );
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

  React.useEffect(() => {
    setDraftConfig(state.gameConfig);
  }, [state.gameConfig]);

  const selectedPack =
    packs.find((pack) => pack.id === state.selectedPackId)?.content ?? BUILTIN_PACK;
  const preparedQuestions =
    state.preparedQuestions.length > 0
      ? state.preparedQuestions
      : buildPreparedQuestions(selectedPack, state.gameConfig);
  const question = preparedQuestions[state.questionIndex] ?? null;
  const canBuzz =
    Boolean(currentTeam) &&
    state.phase === "question" &&
    !state.buzzedTeamId &&
    !state.wrongTeamIds.includes(currentTeam?.id ?? "");
  const teamJoinBaseUrl = `${window.location.origin}${import.meta.env.BASE_URL}#`;
  const previewQuestions = React.useMemo(
    () => buildPreparedQuestions(selectedPack, draftConfig),
    [draftConfig, selectedPack]
  );

  React.useEffect(() => {
    if (state.phase === "question" || state.phase === "buzzed") {
      void playMusic("bgAudience");
      return;
    }

    stopMusic();
  }, [playMusic, state.phase, stopMusic]);

  const [nowTick, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (
      !(state.phase === "question" || state.phase === "buzzed") ||
      !state.timerStartedAt
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.phase, state.timerStartedAt]);

  const currentPrize = question?.points ?? 0;
  const currentGuarantee = React.useMemo(() => {
    const eligibleSafeLevels = [...state.gameConfig.safeLevels]
      .sort((left, right) => left - right)
      .filter((level) => level <= state.questionIndex);
    const lastSafeLevel = eligibleSafeLevels[eligibleSafeLevels.length - 1];

    if (!lastSafeLevel) {
      return 0;
    }

    return preparedQuestions[lastSafeLevel - 1]?.points ?? 0;
  }, [preparedQuestions, state.gameConfig.safeLevels, state.questionIndex]);

  const visibleAnswerCount = React.useMemo(() => {
    if (state.showOptions) {
      return 4;
    }

    if (!state.revealStartedAt) {
      return 0;
    }

    if (state.gameConfig.answerRevealDelay <= 0) {
      return 4;
    }

    const elapsedMs = Math.max(0, nowTick - new Date(state.revealStartedAt).getTime());
    const visibleCount =
      1 + Math.floor(elapsedMs / (state.gameConfig.answerRevealDelay * 1000));

    return Math.max(0, Math.min(4, visibleCount));
  }, [nowTick, state.gameConfig.answerRevealDelay, state.revealStartedAt, state.showOptions]);

  const timerRemaining = React.useMemo(() => {
    if (!state.timerStartedAt || !state.timerDurationSeconds) {
      return null;
    }

    const elapsedMs = Math.max(0, nowTick - new Date(state.timerStartedAt).getTime());
    const nextValue = Math.max(
      0,
      Math.ceil(state.timerDurationSeconds - elapsedMs / 1000)
    );

    return nextValue;
  }, [nowTick, state.timerDurationSeconds, state.timerStartedAt]);

  React.useEffect(() => {
    if (!isHost || timerRemaining !== 0 || state.phase !== "question") {
      return;
    }

    void syncQuestionPhase({
      ...state,
      phase: "resolved",
      buzzedTeamId: null,
      timerStartedAt: null,
      timerDurationSeconds: null,
    });
  }, [isHost, state, timerRemaining]);

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
    const nextQuestions = buildPreparedQuestions(selectedPack, draftConfig);

    await syncQuestionPhase({
      ...state,
      setupStep: "play",
      selectedPackId: state.selectedPackId ?? packs[0]?.id ?? "builtin-millionaire",
      preparedQuestions: nextQuestions,
      gameConfig: draftConfig,
      phase: "setup",
      questionIndex: 0,
      showOptions: false,
      buzzedTeamId: null,
      wrongTeamIds: [],
      lastCorrectTeamId: null,
      revealStartedAt: null,
      timerStartedAt: null,
      timerDurationSeconds: null,
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
      revealStartedAt: new Date().toISOString(),
      timerStartedAt: new Date().toISOString(),
      timerDurationSeconds: state.gameConfig.questionTime,
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
      timerStartedAt: state.setupMode === "single" || everyoneTried ? null : state.timerStartedAt,
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
      Math.max(preparedQuestions.length - 1, 0)
    );

    await syncQuestionPhase({
      ...state,
      questionIndex: nextQuestionIndex,
      phase: "setup",
      showOptions: false,
      buzzedTeamId: null,
      wrongTeamIds: [],
      lastCorrectTeamId: null,
      revealStartedAt: null,
      timerStartedAt: null,
      timerDurationSeconds: null,
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
      timerStartedAt: null,
      timerDurationSeconds: null,
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
        <div className="millionaire-shell grid h-full gap-4">
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
            <div className="millionaire-panel">
              <div className="millionaire-setup-grid">
                <div className="millionaire-panel bg-white/5">
                  <div className="millionaire-section-title">
                    <span className="millionaire-badge">1</span> Тема и вопросы
                  </div>
                  <div className="millionaire-field">
                    <label className="millionaire-label">Тема / пакет</label>
                    <select
                      value={state.selectedPackId ?? packs[0]?.id ?? ""}
                      onChange={(event) => {
                        void changeSelectedPack(event.target.value);
                      }}
                      className="millionaire-select"
                    >
                      {packs.map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          {pack.title}
                        </option>
                      ))}
                    </select>
                    <div className="millionaire-hint">
                      Темы берутся из сохранённых JSON-шаблонов в настройках платформы.
                    </div>
                  </div>
                  <div className="millionaire-field">
                    <label className="millionaire-label">Описание</label>
                    <div className="millionaire-pre whitespace-pre-wrap">
                      {selectedPack.description}
                    </div>
                  </div>
                  <div className="millionaire-two-cols">
                    <div className="millionaire-field">
                      <label className="millionaire-label">Вопросов в паке</label>
                      <input
                        readOnly
                        value={String(selectedPack.questions.length)}
                        className="millionaire-input"
                      />
                    </div>
                    <div className="millionaire-field">
                      <label className="millionaire-label">Будет сыграно</label>
                      <input
                        readOnly
                        value={String(previewQuestions.length)}
                        className="millionaire-input"
                      />
                    </div>
                  </div>
                  <div className="millionaire-field">
                    <label className="millionaire-label">Формат вопроса</label>
                    <pre className="millionaire-pre">
{`{
  "question": "Текст вопроса",
  "options": ["A", "B", "C", "D"],
  "correctOptionId": "a"
}`}
                    </pre>
                  </div>
                </div>

                <div className="millionaire-panel bg-white/5">
                  <div className="millionaire-section-title">
                    <span className="millionaire-badge">2</span> Настройки игры
                  </div>

                  <div className="millionaire-two-cols">
                    <div className="millionaire-field">
                      <label className="millionaire-label">Таймер на вопрос (сек)</label>
                      <input
                        type="number"
                        min="5"
                        max="600"
                        value={draftConfig.questionTime}
                        onChange={(event) =>
                          setDraftConfig((currentConfig) => ({
                            ...currentConfig,
                            questionTime: Math.max(5, Number(event.target.value) || 5),
                          }))
                        }
                        className="millionaire-input"
                      />
                    </div>
                    <div className="millionaire-field">
                      <label className="millionaire-label">Таймер звонка другу (сек)</label>
                      <input
                        type="number"
                        min="5"
                        max="600"
                        value={draftConfig.callTime}
                        onChange={(event) =>
                          setDraftConfig((currentConfig) => ({
                            ...currentConfig,
                            callTime: Math.max(5, Number(event.target.value) || 5),
                          }))
                        }
                        className="millionaire-input"
                      />
                    </div>
                  </div>

                  <div className="millionaire-two-cols">
                    <div className="millionaire-field">
                      <label className="millionaire-label">
                        Задержка между появлениями ответов (сек)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={draftConfig.answerRevealDelay}
                        onChange={(event) =>
                          setDraftConfig((currentConfig) => ({
                            ...currentConfig,
                            answerRevealDelay: Math.max(
                              0,
                              Number(event.target.value) || 0
                            ),
                          }))
                        }
                        className="millionaire-input"
                      />
                    </div>
                    <div className="millionaire-field">
                      <label className="millionaire-label">
                        Количество вопросов (0 = все, максимум 15)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={draftConfig.questionCount}
                        onChange={(event) =>
                          setDraftConfig((currentConfig) => ({
                            ...currentConfig,
                            questionCount: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="millionaire-input"
                      />
                    </div>
                  </div>

                  <div className="millionaire-field">
                    <label className="millionaire-label">
                      Несгораемые уровни (через запятую, 1..15)
                    </label>
                    <input
                      value={draftConfig.safeLevels.join(",")}
                      onChange={(event) =>
                        setDraftConfig((currentConfig) => ({
                          ...currentConfig,
                          safeLevels: event.target.value
                            .split(",")
                            .map((value) => Number(value.trim()))
                            .filter(
                              (value) =>
                                Number.isFinite(value) && value >= 1 && value <= 15
                            ),
                        }))
                      }
                      className="millionaire-input"
                    />
                  </div>

                  <div className="millionaire-two-cols">
                    <div className="millionaire-field">
                      <label className="millionaire-label">Перемешивать вопросы</label>
                      <select
                        value={draftConfig.shuffleQuestions ? "yes" : "no"}
                        onChange={(event) =>
                          setDraftConfig((currentConfig) => ({
                            ...currentConfig,
                            shuffleQuestions: event.target.value === "yes",
                          }))
                        }
                        className="millionaire-select"
                      >
                        <option value="yes">Да</option>
                        <option value="no">Нет</option>
                      </select>
                    </div>
                    <div className="millionaire-field">
                      <label className="millionaire-label">Перемешивать ответы</label>
                      <select
                        value={draftConfig.shuffleAnswers ? "yes" : "no"}
                        onChange={(event) =>
                          setDraftConfig((currentConfig) => ({
                            ...currentConfig,
                            shuffleAnswers: event.target.value === "yes",
                          }))
                        }
                        className="millionaire-select"
                      >
                        <option value="yes">Да</option>
                        <option value="no">Нет</option>
                      </select>
                    </div>
                  </div>

                  <div className="millionaire-hint">
                    Эти параметры взяты из логики `millionare.html` и теперь задаются
                    прямо перед стартом комнаты.
                  </div>

                  <div className="millionaire-actions">
                    <button
                      type="button"
                      className="millionaire-button primary"
                      onClick={() => {
                        void continueToGameplay();
                      }}
                    >
                      Продолжить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : isHost && state.setupMode === "single" ? (
            <div className="grid h-full gap-4">
              <div className="millionaire-circle-wrap">
                <div className="millionaire-circle">
                  <div className="millionaire-circle-time">
                    {timerRemaining === null ? "—" : timerRemaining}
                  </div>
                  <div className="millionaire-circle-sub">сек</div>
                </div>
              </div>
              <MillionaireQuestionView
                question={question}
                questionNumber={state.questionIndex + 1}
                questionCount={preparedQuestions.length || 1}
                prizeLabel={formatRubles(currentPrize)}
                guaranteeLabel={formatRubles(currentGuarantee)}
                timerLabel={timerRemaining === null ? "—" : String(timerRemaining)}
              />
              {state.showOptions || visibleAnswerCount > 0 ? (
                <MillionaireAnswerGrid question={question} visibleCount={visibleAnswerCount} />
              ) : (
                <div className="millionaire-panel text-white/72">
                  Варианты ответа пока скрыты.
                </div>
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
              questionNumber={state.questionIndex + 1}
              questionCount={preparedQuestions.length || 1}
              prizeLabel={formatRubles(currentPrize)}
              guaranteeLabel={formatRubles(currentGuarantee)}
              timerLabel={timerRemaining === null ? "—" : String(timerRemaining)}
              visibleAnswerCount={visibleAnswerCount}
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
                  questionNumber={state.questionIndex + 1}
                  questionCount={preparedQuestions.length || 1}
                  prizeLabel={formatRubles(currentPrize)}
                  guaranteeLabel={formatRubles(currentGuarantee)}
                  timerLabel={timerRemaining === null ? "—" : String(timerRemaining)}
                  visibleAnswerCount={visibleAnswerCount}
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
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="millionaire-panel">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Таблица выигрышей
                </p>
                <div className="mt-4 millionaire-ladder">
                  {preparedQuestions.map((item, index) => {
                    const level = index + 1;
                    return (
                      <div
                        key={item.id}
                        className={[
                          "millionaire-ladder-item",
                          level === state.questionIndex + 1 ? "current" : "",
                          state.gameConfig.safeLevels.includes(level) ? "safe" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span>{level}</span>
                        <span className="sum">{formatRubles(item.points)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
            </div>
          ) : null}

          {isHost && state.setupStep === "play" ? null : null}
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}
