import React from "react";
import { useAuth } from "../../core/auth/useAuth";
import { routes } from "../../core/config/routes";
import { getRecentMafiaRooms } from "../../core/room/mafiaRoomService";
import type { MafiaRoomRecord } from "../../core/room/mafiaRoomTypes";
import { Avatar } from "../../core/ui/Avatar";
import { MafiaBackground } from "../../core/ui/MafiaBackground";
import { useMafiaAudio } from "../../core/audio/MafiaAudioProvider";

export function MafiaHomeScreen({ navigate, onLogout }: { navigate: (path: string) => void; onLogout: () => void }) {
  const { profile } = useAuth();
  const { playMusic, stopMusic } = useMafiaAudio();
  const [rooms, setRooms] = React.useState<MafiaRoomRecord[]>([]);

  React.useEffect(() => {
    void getRecentMafiaRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  React.useEffect(() => {
    void playMusic("bgAudience");
    return stopMusic;
  }, [playMusic, stopMusic]);

  return (
    <main className="mafia-page mafia-home-page">
      <MafiaBackground name="home" className="mafia-bg-home" />
      <section className="mafia-home-content">
        <header className="mafia-topbar">
          <div className="mafia-profile-chip">
            <Avatar name={profile?.displayName ?? "Игрок"} url={profile?.avatarUrl} size="large" />
            <div>
              <strong>{profile?.displayName}</strong>
              <span>Готов к новой партии</span>
            </div>
          </div>
          <button className="mafia-icon-button" onClick={onLogout} aria-label="Выйти из аккаунта">↪</button>
        </header>

        <div className="mafia-hero">
          <h1>MAFIA</h1>
          <p>Мир интриг, алиби и тихих решений. Соберите друзей — город уже засыпает.</p>
          <div className="mafia-hero-actions">
            <button className="mafia-primary-button" onClick={() => navigate(routes.launch("mafia"))}>Создать комнату</button>
            <button className="mafia-secondary-button" onClick={() => navigate(`${routes.launch("mafia")}?join=1`)}>Войти по коду</button>
          </div>
        </div>

        {rooms.length > 0 ? (
          <section className="mafia-recent-rooms">
            <div className="mafia-section-heading">
              <div><span className="mafia-eyebrow">История</span><h2>Недавние комнаты</h2></div>
            </div>
            <div className="mafia-recent-grid">
              {rooms.slice(0, 4).map((room) => (
                <button key={room.id} className="mafia-room-history-card" onClick={() => navigate(routes.game(room.code, "mafia"))}>
                  <span className={`mafia-status-dot mafia-status-dot--${room.status}`} />
                  <strong>{room.name}</strong>
                  <span>{room.code} · {formatRoomStatus(room.status)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function formatRoomStatus(status: MafiaRoomRecord["status"]) {
  if (status === "active") return "идёт игра";
  if (status === "finished") return "завершена";
  if (status === "cancelled") return "закрыта";
  return "лобби";
}
