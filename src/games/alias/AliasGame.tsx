import React from "react";
import { useAudioController } from "../../core/audio/useAudioController";
import { AppLayout } from "../../core/layout/AppLayout";
import { ResponsiveGameFrame } from "../../core/layout/ResponsiveGameFrame";
import { getGamePacksByType } from "../../core/games/gameStateService";
import { useGameState } from "../../core/games/useGameState";
import { usePlayer } from "../../core/player/usePlayer";
import { useRoom } from "../../core/room/useRoom";
import { ScoreBoard } from "../../core/score/ScoreBoard";
import { updateTeamScore } from "../../core/teams/teamService";
import { TeamManager } from "../../core/teams/TeamManager";
import { useTeams } from "../../core/teams/useTeams";
import { Button } from "../../core/ui/Button";
import { Card } from "../../core/ui/Card";
import { updateRoomMeta } from "../../core/room/roomService";
import { QrCodeCard } from "../../core/qr/QrCodeCard";
import { routes } from "../../core/config/routes";
import { clearSession } from "../../utils/storage";
import { createHashAppPath } from "../../shared/routing/basePath";
import { AliasHostScreen } from "./AliasHostScreen";
import { AliasTimer } from "./AliasTimer";
import { AliasTeamScreen } from "./AliasTeamScreen";
import { AliasWordCard } from "./AliasWordCard";
import {
  buildAliasEntry,
  computeAliasScores,
  createInitialAliasState,
  getAliasWinnerTeamId,
  getCurrentAliasWord,
} from "./aliasEngine";
import type { AliasPack, AliasState } from "./aliasTypes";

const BUILTIN_PACK: AliasPack = {
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
    {
      id: "w2",
      text: "Буровая установка",
      difficulty: "medium",
      category: "Нефть и газ",
    },
  ],
};

export function AliasGame({ roomCode }: { roomCode: string }) {
  const { room } = useRoom();
  const { currentPlayer } = usePlayer();
  const { playMusic, stopMusic } = useAudioController();
  const { teams, members, isLoading: teamsLoading, refresh: refreshTeams } = useTeams();
  const { state, updateState, isLoading } = useGameState<AliasState>(
    "alias",
    createInitialAliasState
  );
  const [packs, setPacks] = React.useState<
    Array<{ id: string; title: string; content: AliasPack }>
  >([{ id: "builtin-alias", title: BUILTIN_PACK.title, content: BUILTIN_PACK }]);

  const isHost = Boolean(currentPlayer?.is_host);
  const currentTeamId =
    members.find((member) => member.player_id === currentPlayer?.id)?.team_id ?? null;
  const currentTeam = teams.find((team) => team.id === currentTeamId) ?? null;

  React.useEffect(() => {
    if (room?.id) {
      void updateRoomMeta(room.id, {
        current_game: "alias",
        title: room.title ?? "Abdulkadyrov Games Room",
      });
    }
  }, [room?.id, room?.title]);

  React.useEffect(() => {
    if (!room?.id) {
      return;
    }

    void getGamePacksByType(room.id, "alias").then((records) => {
      const importedPacks = records.map((record) => ({
        id: record.id,
        title: record.title,
        content: record.content as AliasPack,
      }));
      setPacks([
        { id: "builtin-alias", title: BUILTIN_PACK.title, content: BUILTIN_PACK },
        ...importedPacks,
      ]);
    });
  }, [room?.id]);

  const selectedPack =
    packs.find((pack) => pack.id === state.selectedPackId)?.content ?? BUILTIN_PACK;
  const currentWord = getCurrentAliasWord(selectedPack, state);
  const currentTeamByTurn =
    teams[state.currentTeamIndex % Math.max(teams.length, 1)] ?? null;
  const scoreMap = computeAliasScores(teams, state, selectedPack.settings);
  const winnerTeamId =
    state.winnerTeamId ??
    getAliasWinnerTeamId(teams, scoreMap, state.scoreToWin);
  const teamJoinBaseUrl = `${window.location.origin}${import.meta.env.BASE_URL}#`;
  const singleModeTeam = React.useMemo(
    () => ({
      id: "single-device",
      room_id: room?.id ?? "single-device",
      name: "Один экран",
      color: null,
      score: 0,
      created_at: new Date(0).toISOString(),
    }),
    [room?.id]
  );

  React.useEffect(() => {
    if (state.phase === "running") {
      void playMusic("bgGame");
      return;
    }

    stopMusic();
  }, [playMusic, state.phase, stopMusic]);

  React.useEffect(() => {
    if (winnerTeamId && winnerTeamId !== state.winnerTeamId) {
      void updateState({
        ...state,
        phase: "finished",
        winnerTeamId,
      });
    }
  }, [state, updateState, winnerTeamId]);

  React.useEffect(() => {
    if (!isHost || state.phase !== "running" || !state.roundEndsAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(state.roundEndsAt as string).getTime() - Date.now()) / 1000)
      );

      if (remaining !== state.remainingSeconds) {
        void updateState({
          ...state,
          remainingSeconds: remaining as AliasState["remainingSeconds"],
          phase: remaining === 0 ? "round_over" : state.phase,
        });
      }
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isHost, state, updateState]);

  async function persistAliasState(nextState: AliasState) {
    await updateState(nextState);

    if (room?.id) {
      const nextScores = computeAliasScores(teams, nextState, selectedPack.settings);
      await Promise.all(
        teams.map((team) => updateTeamScore(team.id, nextScores[team.id] ?? 0))
      );
      await refreshTeams();
    }
  }

  async function choosePack(packId: string) {
    await persistAliasState({
      ...state,
      setupStep: "pack",
      selectedPackId: packId,
      phase: "setup",
      currentTeamIndex: 0,
      currentWordIndex: 0,
      activeEntries: [],
      rounds: [],
      winnerTeamId: null,
      roundTimeSec: state.roundTimeSec,
      scoreToWin: state.scoreToWin,
      remainingSeconds: state.roundTimeSec,
    });
  }

  async function changeSetupMode(mode: AliasState["setupMode"]) {
    await persistAliasState({
      ...createInitialAliasState(),
      setupMode: mode,
      selectedPackId: state.selectedPackId,
      roundTimeSec: state.roundTimeSec,
      scoreToWin: state.scoreToWin,
      remainingSeconds: state.roundTimeSec,
    });
  }

  async function continueToPackSelection() {
    await persistAliasState({
      ...state,
      setupStep: "pack",
      phase: "setup",
    });
  }

  async function continueToGameplay() {
    await persistAliasState({
      ...state,
      setupStep: "play",
      selectedPackId: state.selectedPackId ?? packs[0]?.id ?? "builtin-alias",
      phase: "setup",
      remainingSeconds: state.roundTimeSec,
    });
  }

  async function startRound() {
    await persistAliasState({
      ...state,
      phase: "running",
      roundEndsAt: new Date(Date.now() + state.remainingSeconds * 1000).toISOString(),
    });
  }

  async function pauseRound() {
    const remaining = state.roundEndsAt
      ? Math.max(
          0,
          Math.ceil((new Date(state.roundEndsAt).getTime() - Date.now()) / 1000)
        )
      : state.remainingSeconds;

    await persistAliasState({
      ...state,
      phase: "paused",
      roundEndsAt: null,
      remainingSeconds: remaining as AliasState["remainingSeconds"],
    });
  }

  async function pushEntry(result: "correct" | "skip" | "mistake") {
    const effectiveTeam = state.setupMode === "single" ? singleModeTeam : currentTeamByTurn;

    if (!effectiveTeam || !currentWord) {
      return;
    }

    const entry = buildAliasEntry({
      teamId: effectiveTeam.id,
      wordId: currentWord.id,
      wordText: currentWord.text,
      result,
    });

    await persistAliasState({
      ...state,
      activeEntries: [...state.activeEntries, entry],
      currentWordIndex: state.currentWordIndex + 1,
    });
  }

  async function nextTurn() {
    const effectiveTeam = state.setupMode === "single" ? singleModeTeam : currentTeamByTurn;
    const round = {
      id: `${Date.now()}-round`,
      teamId: effectiveTeam?.id ?? "",
      entries: state.activeEntries,
      createdAt: new Date().toISOString(),
    };

    await persistAliasState({
      ...state,
      phase: winnerTeamId ? "finished" : "setup",
      currentTeamIndex:
        state.setupMode === "single"
          ? 0
          : teams.length > 0
          ? (state.currentTeamIndex + 1) % teams.length
          : 0,
      activeEntries: [],
      rounds: state.activeEntries.length > 0 ? [...state.rounds, round] : state.rounds,
      roundEndsAt: null,
      remainingSeconds: state.roundTimeSec,
      winnerTeamId: winnerTeamId ?? null,
    });
  }

  async function updateEntryResult(entryId: string, result: "correct" | "skip" | "mistake") {
    await persistAliasState({
      ...state,
      activeEntries: state.activeEntries.map((entry) =>
        entry.id === entryId ? { ...entry, result } : entry
      ),
    });
  }

  async function removeEntry(entryId: string) {
    await persistAliasState({
      ...state,
      activeEntries: state.activeEntries.filter((entry) => entry.id !== entryId),
    });
  }

  function leaveGame() {
    clearSession();
    history.replaceState(null, "", createHashAppPath(routes.gamesHub));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  if (isLoading || teamsLoading) {
    return <AppLayout title="Alias">Загрузка...</AppLayout>;
  }

  const scoreTeams = teams.map((team) => ({
    ...team,
    score: scoreMap[team.id] ?? 0,
  }));
  const singleModeEntries = state.activeEntries;

  return (
    <AppLayout
      title="Alias"
      subtitle={`Комната ${roomCode}`}
      backPath={routes.games(roomCode)}
      actions={
        <Button variant="ghost" onClick={leaveGame}>
          Выйти в главное меню
        </Button>
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
                    Alias на одном телефоне
                  </h3>
                  <p className="mt-3 text-sm font-semibold text-white/70">
                    В этом режиме слово показывается по центру, таймер идёт сверху, а
                    ведущий отмечает угаданные и пропущенные слова на одном устройстве.
                  </p>
                  <div className="mt-5">
                    <Button variant="primary" onClick={() => void continueToPackSelection()}>
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
                    Создайте команды и дайте участникам войти прямо в свои команды.
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {teams.map((team) => (
                      <QrCodeCard
                        key={team.id}
                        title={`QR команды ${team.name}`}
                        value={`${teamJoinBaseUrl}${routes.gameJoin(
                          "alias",
                          roomCode,
                          team.id
                        )}`}
                      />
                    ))}
                  </div>
                  <div className="mt-5">
                    <Button variant="primary" onClick={() => void continueToPackSelection()}>
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
                Тема и правила раунда
              </h3>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Тема / пакет
                </span>
                <select
                  value={state.selectedPackId ?? packs[0]?.id ?? ""}
                  onChange={(event) => {
                    void choosePack(event.target.value);
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

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
                    Время раунда
                  </span>
                  <select
                    value={state.roundTimeSec}
                    onChange={(event) => {
                      void persistAliasState({
                        ...state,
                        setupStep: "pack",
                        roundTimeSec: Number(event.target.value) as AliasState["roundTimeSec"],
                        remainingSeconds: Number(event.target.value),
                      });
                    }}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
                  >
                    {[30, 60, 90].map((value) => (
                      <option key={value} value={value}>
                        {value} секунд
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/55">
                    Очки для победы
                  </span>
                  <select
                    value={state.scoreToWin}
                    onChange={(event) => {
                      void persistAliasState({
                        ...state,
                        setupStep: "pack",
                        scoreToWin: Number(event.target.value) as AliasState["scoreToWin"],
                      });
                    }}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#04101d] px-4 text-sm font-semibold text-white outline-none"
                  >
                    {[25, 50, 75, 100].map((value) => (
                      <option key={value} value={value}>
                        До {value} очков
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-lg font-black text-white">{selectedPack.title}</p>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  {selectedPack.description}
                </p>
                <p className="mt-2 text-sm font-semibold text-white/70">
                  Слов: {selectedPack.words.length} · Раунд: {state.roundTimeSec} сек ·
                  Победа: {state.scoreToWin} очков
                </p>
              </div>

              <div className="mt-5">
                <Button variant="primary" onClick={() => void continueToGameplay()}>
                  Продолжить
                </Button>
              </div>
            </Card>
          ) : isHost && state.setupMode === "single" ? (
            state.phase === "round_over" ? (
              <Card>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
                  Результат раунда
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">Проверка слов</h3>
                <div className="mt-4 space-y-3">
                  {singleModeEntries.length === 0 ? (
                    <p className="text-sm font-semibold text-white/65">
                      За этот раунд не было отмечено слов.
                    </p>
                  ) : (
                    singleModeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-white">{entry.wordText}</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void updateEntryResult(entry.id, "correct");
                              }}
                              className={[
                                "rounded-full px-3 py-1 text-xs font-black",
                                entry.result === "correct"
                                  ? "bg-emerald-500 text-white"
                                  : "bg-white/10 text-white/70",
                              ].join(" ")}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void updateEntryResult(entry.id, "skip");
                              }}
                              className={[
                                "rounded-full px-3 py-1 text-xs font-black",
                                entry.result === "skip"
                                  ? "bg-red-500 text-white"
                                  : "bg-white/10 text-white/70",
                              ].join(" ")}
                            >
                              Без ✓
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-5">
                  <Button variant="primary" onClick={() => void nextTurn()}>
                    Продолжить
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid h-full grid-rows-[auto_1fr_auto] gap-4">
                <div className="flex justify-center">
                  <AliasTimer seconds={state.remainingSeconds} />
                </div>
                <AliasWordCard word={currentWord} />
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    className="min-h-[4.5rem] border-red-500 bg-red-500 text-white hover:bg-red-600"
                    onClick={() => {
                      void pushEntry("skip");
                    }}
                  >
                    Пропустить
                  </Button>
                  <Button
                    className="min-h-[4.5rem] border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                    onClick={() => {
                      void pushEntry("correct");
                    }}
                  >
                    Угадали
                  </Button>
                </div>
              </div>
            )
          ) : isHost ? (
            <AliasHostScreen
              teams={teams}
              scores={scoreMap}
              currentTeam={currentTeamByTurn}
              word={currentWord}
              state={state}
              onScoreToWinChange={(value) => {
                void persistAliasState({
                  ...state,
                  scoreToWin: value,
                });
              }}
              onRoundTimeChange={(value) => {
                void persistAliasState({
                  ...state,
                  roundTimeSec: value,
                  remainingSeconds: value,
                });
              }}
              onChoosePack={choosePack}
              packOptions={packs.map((pack) => ({ id: pack.id, title: pack.title }))}
              onStart={startRound}
              onPause={pauseRound}
              onMarkCorrect={() => {
                void pushEntry("correct");
              }}
              onSkip={() => {
                void pushEntry("skip");
              }}
              onMistake={() => {
                void pushEntry("mistake");
              }}
              onNextTurn={nextTurn}
              onUpdateEntryResult={updateEntryResult}
              onRemoveEntry={removeEntry}
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
                  Ведущий завершает настройку темы и параметров Alias. После этого
                  начнётся раунд вашей команды.
                </p>
              </Card>
            ) : (
              <div className="grid h-full gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <AliasTeamScreen team={currentTeam} word={currentWord} state={state} />
                <ScoreBoard teams={scoreTeams} />
              </div>
            )
          )}

          <Card>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
              История раундов
            </p>
            <div className="mt-4 space-y-3">
              {state.rounds.length === 0 ? (
                <p className="text-sm font-semibold text-white/65">
                  История появится после завершения первого хода.
                </p>
              ) : (
                state.rounds
                  .slice()
                  .reverse()
                  .map((round) => (
                    <div
                      key={round.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <p className="font-black text-white">
                        {teams.find((team) => team.id === round.teamId)?.name ?? "Команда"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-white/70">
                        {round.entries.map((entry) => (
                          <span
                            key={entry.id}
                            className="rounded-full border border-white/10 bg-[#04101d] px-3 py-1"
                          >
                            {entry.wordText}:{" "}
                            {entry.result === "correct"
                              ? "отгадали"
                              : entry.result === "skip"
                              ? "пропуск"
                              : "ошибка"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Card>
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}
