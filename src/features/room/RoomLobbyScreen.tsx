import React from "react";
import { MafiaBackground } from "../../core/ui/MafiaBackground";
import { mafiaCommands } from "../../core/game/gameCommands";
import type { MafiaSnapshot } from "../../core/room/mafiaRoomTypes";
import { PlayerCard } from "../../core/ui/PlayerCard";
import type { DeviceInventory } from "../../core/video/mediaDevices";
import type { VideoParticipant, VideoProvider } from "../../core/video/videoTypes";
import { GameChat } from "../chat/GameChat";
import { DeviceCheckModal } from "../video/DeviceCheckModal";
import { VideoControls } from "../video/VideoControls";
import { VideoGrid } from "../video/VideoGrid";
import { RoomQrCode } from "./RoomQrCode";
import { RoomSettingsPanel } from "./RoomSettingsPanel";

type VideoState = {
  provider: VideoProvider;
  localStream: MediaStream | null;
  participants: VideoParticipant[];
  devices: DeviceInventory;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  selectedCameraDeviceId: string;
  selectedMicrophoneDeviceId: string;
  selectedOutputDeviceId: string;
  joined: boolean;
  error: string;
};

export function RoomLobbyScreen({
  snapshot,
  applySnapshot,
  video,
  onLeave,
  onCancel,
}: {
  snapshot: MafiaSnapshot;
  applySnapshot: (snapshot: MafiaSnapshot) => void;
  video: VideoState;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const [showQr, setShowQr] = React.useState(false);
  const [showDevices, setShowDevices] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const selfPlayer = snapshot.players.find((player) => player.id === snapshot.self.roomPlayerId)!;
  const inviteUrl = `${location.origin}${import.meta.env.BASE_URL}#${`/game/mafia/join?roomCode=${snapshot.room.code}`}`;
  const allReady = snapshot.players.length >= 6 && snapshot.players.every((player) => player.is_host || player.is_ready);

  async function run(label: string, action: () => Promise<MafiaSnapshot>) {
    setBusy(label);
    setError("");
    try { applySnapshot(await action()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось выполнить действие"); }
    finally { setBusy(""); }
  }

  async function share() {
    const data = { title: snapshot.room.name, text: `Присоединяйтесь к Mafia. Код: ${snapshot.room.code}`, url: inviteUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(inviteUrl); setError("Ссылка скопирована"); }
    } catch { /* пользователь закрыл системный диалог */ }
  }

  return (
    <main className="mafia-page mafia-lobby-page">
      <MafiaBackground name="lobby" />
      <div className="mafia-game-shell">
        <header className="mafia-room-header">
          <button className="mafia-icon-button" onClick={onLeave} aria-label="Выйти из комнаты">←</button>
          <div className="mafia-room-title"><strong>{snapshot.room.name}</strong><button onClick={() => void navigator.clipboard.writeText(snapshot.room.code)}>ⓘ {snapshot.room.code}</button></div>
          <div className="mafia-room-header-actions">
            <span>♟ {snapshot.players.length} / {snapshot.room.max_players}</span>
            <button className="mafia-icon-button" onClick={() => setShowQr(true)} aria-label="Показать QR">▦</button>
            {snapshot.self.isHost ? <button className="mafia-icon-button" onClick={() => setShowSettings(true)} aria-label="Настройки">⚙</button> : null}
          </div>
        </header>

        <div className="mafia-lobby-layout">
          <section className="mafia-lobby-main">
            <div className="mafia-section-heading"><div><span className="mafia-eyebrow">Игроки</span><h1>Комната ожидания</h1></div><button className="mafia-secondary-button mafia-share-button" onClick={() => void share()}>Поделиться</button></div>
            <div className="mafia-player-grid">
              {snapshot.players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  actions={snapshot.self.isHost && !player.is_host ? (
                    <details className="mafia-player-menu">
                      <summary>•••</summary>
                      <div>
                        <button onClick={() => void run("host", () => mafiaCommands.transferHost(snapshot.room.id, player.user_id))}>Сделать ведущим</button>
                        <button onClick={() => void run("mute", () => mafiaCommands.hostMute(snapshot.room.id, player.user_id, !player.microphone_blocked))}>{player.microphone_blocked ? "Разрешить микрофон" : "Отключить микрофон"}</button>
                        <button className="danger" onClick={() => void run("kick", () => mafiaCommands.kickPlayer(snapshot.room.id, player.user_id))}>Исключить</button>
                      </div>
                    </details>
                  ) : undefined}
                />
              ))}
              {Array.from({ length: Math.max(0, Math.min(snapshot.room.max_players, 12) - snapshot.players.length) }, (_, index) => (
                <div className="mafia-empty-player" key={index}><span>＋</span><strong>Свободно</strong></div>
              ))}
            </div>

            {snapshot.room.video_enabled && video.joined ? (
              <div className="mafia-lobby-video-preview">
                <VideoGrid players={snapshot.players} selfUserId={selfPlayer.user_id} localStream={video.localStream} participants={video.participants} outputDeviceId={video.selectedOutputDeviceId} />
              </div>
            ) : null}
          </section>

          <aside className="mafia-lobby-sidebar">
            <GameChat snapshot={snapshot} defaultChannel="room_chat" />
          </aside>
        </div>

        <footer className="mafia-action-bar mafia-lobby-actions">
          {snapshot.room.video_enabled ? (
            video.joined ? (
              <VideoControls provider={video.provider} cameraEnabled={video.cameraEnabled} microphoneEnabled={video.microphoneEnabled} microphoneAllowed joined onSettings={() => setShowDevices(true)} />
            ) : (
              <button className="mafia-secondary-button" onClick={() => setShowDevices(true)}>Проверить камеру и микрофон</button>
            )
          ) : <span className="mafia-muted-copy">Видеосвязь отключена ведущим</span>}
          {!snapshot.self.isHost ? (
            <button className={selfPlayer.is_ready ? "mafia-secondary-button" : "mafia-primary-button"} disabled={Boolean(busy)} onClick={() => void run("ready", () => mafiaCommands.setReady(snapshot.room.id, !selfPlayer.is_ready))}>
              {selfPlayer.is_ready ? "Я не готов" : "Я готов"}
            </button>
          ) : (
            <>
              <button className="mafia-secondary-button" onClick={() => void run("lock", () => mafiaCommands.lockRoom(snapshot.room.id, !snapshot.room.join_locked))}>{snapshot.room.join_locked ? "Открыть вход" : "Закрыть вход"}</button>
              <button className="mafia-primary-button" disabled={!allReady || Boolean(busy)} onClick={() => void run("start", () => mafiaCommands.startGame(snapshot.room.id))}>
                {busy === "start" ? "Распределяем роли…" : "Начать игру"}
              </button>
            </>
          )}
        </footer>
        {(error || video.error) ? <div className="mafia-toast" role="status">{error || video.error}</div> : null}
      </div>

      {showQr ? <div className="mafia-modal-backdrop" onMouseDown={() => setShowQr(false)}><section className="mafia-modal mafia-qr-modal" onMouseDown={(event) => event.stopPropagation()}><button className="mafia-modal-close" onClick={() => setShowQr(false)}>×</button><RoomQrCode value={inviteUrl} code={snapshot.room.code} /><button className="mafia-primary-button" onClick={() => void share()}>Поделиться приглашением</button></section></div> : null}
      <DeviceCheckModal open={showDevices} onClose={() => setShowDevices(false)} provider={video.provider} devices={video.devices} joined={video.joined} roomId={snapshot.room.id} selectedCameraDeviceId={video.selectedCameraDeviceId} selectedMicrophoneDeviceId={video.selectedMicrophoneDeviceId} selectedOutputDeviceId={video.selectedOutputDeviceId} />
      <RoomSettingsPanel snapshot={snapshot} open={showSettings} onClose={() => setShowSettings(false)} onSaved={applySnapshot} onCancel={onCancel} />
    </main>
  );
}
