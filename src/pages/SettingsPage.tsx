import { AppLayout } from "../core/layout/AppLayout";
import { Card } from "../core/ui/Card";
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
      <Card>
        <RoomSettingsForm
          settings={room.settings as RoomSettings}
          onChange={(settings) => {
            void updateRoomSettings(room.id, settings).then(() => refresh());
          }}
        />
      </Card>
    </AppLayout>
  );
}

