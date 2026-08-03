import React from "react";
import { MafiaBackground } from "../../core/ui/MafiaBackground";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaPlayerView, MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { PlayerCard } from "../../core/ui/PlayerCard";
import { PhaseTimer } from "../../core/ui/PhaseTimer";
import type { VideoParticipant, VideoProvider } from "../../core/video/videoTypes";
import { GameChat } from "../chat/GameChat";
import { VideoControls } from "../video/VideoControls";
import { VideoGrid } from "../video/VideoGrid";

type VideoState = {
  provider: VideoProvider;
  localStream: MediaStream | null;
  participants: VideoParticipant[];
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  selectedOutputDeviceId: string;
  available: boolean;
  joined: boolean;
};

export function DayScreen({ snapshot, applySnapshot, video, onDeviceSettings, onCancel }: {
  snapshot: MafiaSnapshot;
  applySnapshot: (snapshot: MafiaSnapshot) => void;
  video: VideoState;
  onDeviceSettings: () => void;
  onCancel: () => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [voted, setVoted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const phase = snapshot.game?.phase ?? "day_announcement";
  const self = snapshot.players.find((player) => player.id === snapshot.self.roomPlayerId)!;
  const canVote = phase === "day_voting" && snapshot.self.lifeStatus === "alive" && !voted;
  const targets = snapshot.players.filter((player) => player.life_status === "alive" && !(player.is_host && snapshot.room.settings.hostPlays === false) && player.gamePlayerId && player.id !== self.id);
  const currentRound = snapshot.game?.round_number ?? 1;
  const roundEvents = snapshot.events.filter((event) => event.round_number === currentRound);
  const deathEvents = roundEvents.filter((event) => event.event_type === "player_died");
  const execution = [...roundEvents].reverse().find((event) => event.event_type === "player_executed" || event.event_type === "vote_tied");

  async function vote(player: MafiaPlayerView) {
    if (!canVote || !player.gamePlayerId) return;
    setSelectedId(player.id);
    setBusy(true);
    setError("");
    try {
      await mafiaCommands.vote(snapshot.room.id, player.gamePlayerId);
      setVoted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить голос");
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    setBusy(true);
    setError("");
    try {
      applySnapshot(await mafiaCommands.advancePhase(snapshot.room.id, snapshot.room.phase_version));
      setVoted(false);
      setSelectedId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось продолжить игру");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`mafia-page mafia-day-page mafia-day-page--${phase}`}>
      <MafiaBackground name={phase === "day_voting" ? "voting" : "day"} />
      <section className="mafia-day-shell">
        <header className="mafia-phase-header">
          <div><span className="mafia-eyebrow">День {currentRound}</span><h1>{phaseTitle(phase)}</h1><p>{phaseSubtitle(phase, voted)}</p></div>
          <PhaseTimer endsAt={snapshot.room.phase_ends_at} onExpire={snapshot.room.auto_phase ? () => void advance() : undefined} />
        </header>

        {phase === "day_announcement" ? (
          <section className="mafia-announcement-panel">
            <span className="mafia-sun-mark">☀</span>
            {deathEvents.length === 0 ? <><h2>Этой ночью никто не погиб</h2><p>Доктор мог спасти город — или мафия не пришла к решению.</p></> : (
              <><h2>Город потерял {deathEvents.length === 1 ? "игрока" : `${deathEvents.length} игроков`}</h2><div className="mafia-announced-players">{deathEvents.map((event) => { const player = findPlayerByGameId(snapshot, String(event.payload.playerId)); return player ? <PlayerCard key={String(event.id)} player={player} compact /> : null; })}</div></>
            )}
          </section>
        ) : null}

        {phase === "day_discussion" ? (
          <div className="mafia-discussion-layout">
            <section className="mafia-discussion-video">
              {video.available && video.joined ? <VideoGrid players={snapshot.players} selfUserId={self.user_id} localStream={video.localStream} participants={video.participants} outputDeviceId={video.selectedOutputDeviceId} /> : <div className="mafia-video-disabled"><span>◉</span><h2>{video.available ? "Видеокомната не подключена" : "Наблюдение отключено настройками"}</h2>{video.available ? <button className="mafia-secondary-button" onClick={onDeviceSettings}>Подключить устройства</button> : null}</div>}
              {snapshot.room.video_enabled && video.joined ? <VideoControls provider={video.provider} cameraEnabled={video.cameraEnabled} microphoneEnabled={video.microphoneEnabled} microphoneAllowed={snapshot.self.lifeStatus === "alive"} joined onSettings={onDeviceSettings} /> : null}
            </section>
            <aside><GameChat snapshot={snapshot} defaultChannel={snapshot.self.lifeStatus === "dead" ? "dead_chat" : "alive_chat"} /></aside>
          </div>
        ) : null}

        {phase === "day_voting" ? (
          <section className="mafia-voting-panel">
            <div className="mafia-target-grid mafia-voting-grid">
              {targets.map((player) => <PlayerCard key={player.id} player={player} selected={player.id === selectedId} disabled={!canVote || busy} onClick={() => void vote(player)} />)}
            </div>
            {snapshot.self.lifeStatus === "dead" ? <div className="mafia-dead-restriction">† Погибшие не участвуют в голосовании.</div> : voted ? <div className="mafia-vote-confirmed">✓ Ваш голос сохранён и защищён сервером.</div> : null}
          </section>
        ) : null}

        {phase === "day_execution" ? (
          <section className="mafia-execution-panel">
            {execution?.event_type === "player_executed" ? (() => {
              const player = findPlayerByGameId(snapshot, String(execution.payload.eliminatedPlayerId));
              return <><span className="mafia-gavel">⚖</span><h2>Решение города принято</h2>{player ? <PlayerCard player={player} compact /> : null}<p>Игрок исключён из партии. Его микрофон отключён, а игровые действия заблокированы.</p></>;
            })() : <><span className="mafia-gavel">⚖</span><h2>Голоса разделились</h2><p>При ничьей никто не покидает город. Наступает следующая ночь.</p></>}
          </section>
        ) : null}

        {phase !== "day_discussion" ? <aside className="mafia-day-chat"><GameChat snapshot={snapshot} defaultChannel={snapshot.self.lifeStatus === "dead" ? "dead_chat" : "alive_chat"} /></aside> : null}

        {snapshot.self.isHost ? <footer className="mafia-action-bar"><span className="mafia-muted-copy">Ведущий управляет переходом после готовности игроков.</span><button className="mafia-secondary-button danger" onClick={onCancel}>Отменить игру</button><button className="mafia-primary-button" disabled={busy} onClick={() => void advance()}>{busy ? "Обрабатываем…" : advanceLabel(phase)}</button></footer> : null}
        {error ? <div className="mafia-toast">{error}</div> : null}
      </section>
    </main>
  );
}

function findPlayerByGameId(snapshot: MafiaSnapshot, gamePlayerId: string) {
  return snapshot.players.find((player) => player.gamePlayerId === gamePlayerId);
}

function phaseTitle(phase: string) {
  if (phase === "day_announcement") return "Город просыпается";
  if (phase === "day_discussion") return "Обсуждение";
  if (phase === "day_voting") return "Кого исключить?";
  return "Результаты голосования";
}

function phaseSubtitle(phase: string, voted: boolean) {
  if (phase === "day_announcement") return "События ночи становятся известны всем.";
  if (phase === "day_discussion") return "Только живые игроки могут говорить и писать в общий чат.";
  if (phase === "day_voting") return voted ? "Ваш голос принят." : "Каждый живой игрок голосует один раз.";
  return "Решение применяется ко всем клиентам одновременно.";
}

function advanceLabel(phase: string) {
  if (phase === "day_announcement") return "Начать обсуждение";
  if (phase === "day_discussion") return "Начать голосование";
  if (phase === "day_voting") return "Подсчитать голоса";
  return "Начать следующую ночь";
}
