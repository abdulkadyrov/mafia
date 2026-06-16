import { AppLayout } from "../core/layout/AppLayout";
import { Card } from "../core/ui/Card";
import { TeamManager } from "../core/teams/TeamManager";
import { QrCodeCard } from "../core/qr/QrCodeCard";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import { useRoom } from "../core/room/useRoom";
import { updateRoomSettings } from "../services/roomService";
import type { RoomSettings } from "../types/game";

export function SettingsPage() {
  const { room, refresh } = useRoom();

  if (!room) {
    return <AppLayout title="Настройки комнаты">Комната не найдена.</AppLayout>;
  }

  return (
    <AppLayout
      title="Настройки комнаты"
      subtitle="Параметры комнаты Abdulkadyrov Games"
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <RoomSettingsForm
            settings={room.settings as RoomSettings}
            onChange={(settings) => {
              void updateRoomSettings(room.id, settings).then(() => refresh());
            }}
          />
        </Card>
        <div className="grid gap-4">
          <TeamManager />
          <QrCodeCard
            title="Подключение к комнате"
            value={window.location.origin + import.meta.env.BASE_URL + `#${`/room/${room.code}`}`}
          />
        </div>
      </div>
    </AppLayout>
  );
}
