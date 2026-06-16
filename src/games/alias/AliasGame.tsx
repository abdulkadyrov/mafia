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
import { AliasTeamScreen } from "./AliasTeamScreen";
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
      ...createInitialAliasState(),
      selectedPackId: packId,
      roundTimeSec: state.roundTimeSec,
      scoreToWin: state.scoreToWin,
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
    if (!currentTeamByTurn || !currentWord) {
      return;
    }

    const entry = buildAliasEntry({
      teamId: currentTeamByTurn.id,
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
    const round = {
      id: `${Date.now()}-round`,
      teamId: currentTeamByTurn?.id ?? "",
      entries: state.activeEntries,
      createdAt: new Date().toISOString(),
    };

    await persistAliasState({
      ...state,
      phase: winnerTeamId ? "finished" : "setup",
      currentTeamIndex: teams.length > 0 ? (state.currentTeamIndex + 1) % teams.length : 0,
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

  return (
    <AppLayout
      title="Alias"
      subtitle={`Комната ${roomCode}`}
      actions={
        <Button variant="ghost" onClick={leaveGame}>
          Выйти в главное меню
        </Button>
      }
    >
      <ResponsiveGameFrame>
        <div className="grid h-full gap-4">
          {teams.length === 0 ? (
            <TeamManager />
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
            <div className="grid h-full gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <AliasTeamScreen team={currentTeam} word={currentWord} state={state} />
              <ScoreBoard teams={scoreTeams} />
            </div>
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

          {isHost && teams.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          ) : null}
        </div>
      </ResponsiveGameFrame>
    </AppLayout>
  );
}
