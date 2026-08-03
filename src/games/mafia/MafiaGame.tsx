import React from "react";
import { useAuth } from "../../core/auth/useAuth";
import { canPublishAudio } from "../../core/video/audioPermissions";
import { useVideoRoom } from "../../core/video/useVideoRoom";
import { mafiaCommands } from "../../core/game/gameCommands";
import { forgetMafiaRoom } from "../../core/room/mafiaRoomService";
import { useMafiaRoom } from "../../core/room/useMafiaRoom";
import { DayScreen } from "../../features/day/DayScreen";
import { NightScreen } from "../../features/night/NightScreen";
import { GameResultsScreen } from "../../features/results/GameResultsScreen";
import { RoleRevealScreen } from "../../features/role-reveal/RoleRevealScreen";
import { RoomLobbyScreen } from "../../features/room/RoomLobbyScreen";
import { DeviceCheckModal } from "../../features/video/DeviceCheckModal";
import { useMafiaAudio } from "../../core/audio/MafiaAudioProvider";

export function MafiaGame({ onHome, onNewRoom }: { onHome: () => void; onNewRoom: () => void }) {
  const { user } = useAuth();
  const { playMusic, playSfx, stopMusic } = useMafiaAudio();
  const { snapshot, isLoading, error, realtimeStatus, applySnapshot } = useMafiaRoom();
  const [showDevices, setShowDevices] = React.useState(false);
  const roomId = snapshot?.room.id ?? null;
  const selfRoomPlayerId = snapshot?.self.roomPlayerId ?? null;
  const players = React.useMemo(() => snapshot?.players ?? [], [snapshot?.players]);
  const selfPlayerPresent = players.some((player) => player.id === selfRoomPlayerId);
  const audioAllowed = snapshot ? canPublishAudio({
    phase: snapshot.room.phase,
    lifeStatus: snapshot.self.lifeStatus,
    team: snapshot.self.team ?? (snapshot.self.isHost ? "host" : "city"),
    isHost: snapshot.self.team === "host",
    hostMuted: snapshot.players.find((player) => player.id === snapshot.self.roomPlayerId)?.microphone_blocked ?? false,
  }) : false;
  const videoAllowed = Boolean(snapshot?.room.video_enabled && (
    snapshot.self.lifeStatus !== "dead" || snapshot.room.dead_can_observe || snapshot.self.isHost
  ));
  const video = useVideoRoom({ roomId, enabled: videoAllowed, audioAllowed });
  const phase = snapshot?.room.phase;
  const winningTeam = snapshot?.game?.winning_team;
  const previousPhaseRef = React.useRef<typeof phase>();
  const latestEventRef = React.useRef<string | number | null>(null);

  React.useEffect(() => {
    if (!phase) return;
    void playMusic(phase.startsWith("night_") ? "clockTick" : "bgAudience");
    if (previousPhaseRef.current !== phase) {
      const cue = phase === "game_over" ? (winningTeam === "mafia" ? "wrong" : "correctHard") : phaseCue(phase);
      if (cue) void playSfx(cue);
      previousPhaseRef.current = phase;
    }
  }, [phase, playMusic, playSfx, winningTeam]);

  React.useEffect(() => {
    const latest = snapshot?.events.at(-1);
    if (!latest) return;
    if (latestEventRef.current === null) {
      latestEventRef.current = latest.id;
      return;
    }
    if (latestEventRef.current === latest.id) return;
    latestEventRef.current = latest.id;
    if (latest.event_type === "player_died") void playSfx("wrong");
    if (latest.event_type === "night_resolved" && Array.isArray(latest.payload.savedPlayerIds) && latest.payload.savedPlayerIds.length > 0) void playSfx("correctHard");
  }, [playSfx, snapshot?.events]);

  React.useEffect(() => stopMusic, [stopMusic]);

  React.useEffect(() => {
    if (!roomId || !video.joined || !selfPlayerPresent) return;
    void mafiaCommands.setMediaStatus(
      roomId,
      video.cameraEnabled,
      video.microphoneEnabled && audioAllowed,
      realtimeStatus === "SUBSCRIBED" ? "good" : "poor"
    ).catch(() => undefined);
  }, [audioAllowed, realtimeStatus, roomId, selfPlayerPresent, video.cameraEnabled, video.joined, video.microphoneEnabled]);

  React.useEffect(() => {
    if (!video.joined || !user) return;
    for (const player of players) {
      if (player.user_id === user.id) continue;
      const allowed = player.life_status === "alive" && !player.microphone_blocked && player.microphone_enabled;
      void video.provider.setPlayerAudioPermission(player.user_id, allowed);
    }
  }, [players, user, video.joined, video.provider]);

  React.useEffect(() => {
    if (!videoAllowed && video.joined) void video.provider.leaveRoom().catch(() => undefined);
  }, [video.joined, video.provider, videoAllowed]);

  if (isLoading) {
    return <main className="mafia-loading-screen"><div className="mafia-loading-mark">M</div><p>Открываем комнату…</p></main>;
  }
  if (!snapshot) {
    return <main className="mafia-loading-screen mafia-loading-screen--error"><div className="mafia-loading-mark">!</div><h1>Комната недоступна</h1><p>{error}</p><button className="mafia-primary-button" onClick={onHome}>Вернуться в меню</button></main>;
  }
  const activeSnapshot = snapshot;

  async function leave() {
    await video.provider.leaveRoom().catch(() => undefined);
    await mafiaCommands.leave(activeSnapshot.room.id).catch(() => undefined);
    forgetMafiaRoom(activeSnapshot.room.code);
    onHome();
  }

  async function cancel() {
    if (!window.confirm("Отменить игру для всех участников?")) return;
    await video.provider.leaveRoom().catch(() => undefined);
    await mafiaCommands.cancelRoom(activeSnapshot.room.id);
    forgetMafiaRoom(activeSnapshot.room.code);
    onHome();
  }

  if (snapshot.room.phase === "lobby") {
    return <RoomLobbyScreen snapshot={snapshot} applySnapshot={applySnapshot} video={video} onLeave={() => void leave()} onCancel={() => void cancel()} />;
  }
  if (snapshot.room.phase === "role_reveal") {
    return <RoleRevealScreen snapshot={snapshot} applySnapshot={applySnapshot} />;
  }
  if (snapshot.room.phase.startsWith("night_")) {
    return <NightScreen snapshot={snapshot} applySnapshot={applySnapshot} onCancel={() => void cancel()} />;
  }
  if (snapshot.room.phase.startsWith("day_")) {
    return (
      <>
        <DayScreen snapshot={snapshot} applySnapshot={applySnapshot} video={{ ...video, available: videoAllowed }} onDeviceSettings={() => setShowDevices(true)} onCancel={() => void cancel()} />
        <DeviceCheckModal open={showDevices} onClose={() => setShowDevices(false)} provider={video.provider} devices={video.devices} joined={video.joined} roomId={snapshot.room.id} selectedCameraDeviceId={video.selectedCameraDeviceId} selectedMicrophoneDeviceId={video.selectedMicrophoneDeviceId} selectedOutputDeviceId={video.selectedOutputDeviceId} />
      </>
    );
  }
  return <GameResultsScreen snapshot={snapshot} applySnapshot={applySnapshot} onHome={onHome} onNewRoom={onNewRoom} />;
}

function phaseCue(phase: NonNullable<ReturnType<typeof useMafiaRoom>["snapshot"]>["room"]["phase"]) {
  if (phase === "lobby") return "nextQuestion" as const;
  if (phase === "role_reveal") return "lockIn" as const;
  if (phase === "night_intro") return "intro" as const;
  if (phase === "night_resolution") return "answerLocked" as const;
  if (phase === "day_announcement") return "nextQuestion" as const;
  if (phase === "day_voting") return "lockIn" as const;
  if (phase === "day_execution") return "wrong" as const;
  return null;
}
