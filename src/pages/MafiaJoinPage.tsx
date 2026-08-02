import React from "react";
import { routes } from "../core/config/routes";
import { joinMafiaRoom } from "../core/room/mafiaRoomService";

export function MafiaJoinPage({ roomCode, navigate }: { roomCode: string; navigate: (path: string) => void }) {
  const [error, setError] = React.useState("");
  const [joining, setJoining] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    void joinMafiaRoom(roomCode)
      .then((snapshot) => { if (active) navigate(routes.game(snapshot.room.code, "mafia")); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Не удалось войти в комнату"); })
      .finally(() => { if (active) setJoining(false); });
    return () => { active = false; };
  }, [navigate, roomCode]);
  return (
    <main className="mafia-loading-screen">
      <div className="mafia-loading-mark">{error ? "!" : "M"}</div>
      <h1>{error ? "Приглашение недоступно" : "Входим в комнату"}</h1>
      <p>{error || `Код ${roomCode}. Проверяем место и состояние партии…`}</p>
      {!joining && error ? <button className="mafia-primary-button" onClick={() => navigate(routes.home)}>Вернуться в меню</button> : null}
    </main>
  );
}
