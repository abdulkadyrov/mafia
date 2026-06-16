import { AppLayout } from "../core/layout/AppLayout";
import { Card } from "../core/ui/Card";
import { TeamManager } from "../core/teams/TeamManager";
import { QrCodeCard } from "../core/qr/QrCodeCard";
import { useRoom } from "../core/room/useRoom";
import { routes } from "../core/config/routes";
import { ImportJsonPack } from "../core/packs/ImportJsonPack";

export function SettingsPage() {
  const { room } = useRoom();

  if (!room) {
    return <AppLayout title="Настройки комнаты">Комната не найдена.</AppLayout>;
  }

  const currentRoom = room;
  const currentGameId = currentRoom.current_game ?? "mafia";
  const roomJoinUrl =
    window.location.origin +
    import.meta.env.BASE_URL +
    `#${routes.gameJoin(currentGameId, currentRoom.code)}`;

  return (
    <AppLayout
      title="Настройки комнаты"
      subtitle="Здесь только темы и JSON-паки для Millionaire и Alias"
      backPath={routes.games(currentRoom.code)}
    >
      <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="grid gap-4">
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Кто хочет стать миллионером
            </p>
            <div className="mt-4">
              <ImportJsonPack roomId={currentRoom.id} initialGame="millionaire" />
            </div>
          </Card>

          <Card>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Alias
            </p>
            <div className="mt-4">
              <ImportJsonPack roomId={currentRoom.id} initialGame="alias" />
            </div>
          </Card>
        </div>
        <div className="grid gap-4">
          <TeamManager />
          <QrCodeCard
            title="Подключение к комнате"
            value={roomJoinUrl}
          />
        </div>
      </div>
    </AppLayout>
  );
}
