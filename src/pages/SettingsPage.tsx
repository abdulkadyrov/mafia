import { AppLayout } from "../core/layout/AppLayout";
import { Card } from "../core/ui/Card";
import { TeamManager } from "../core/teams/TeamManager";
import { QrCodeCard } from "../core/qr/QrCodeCard";
import { RoomSettingsForm } from "../features/room-settings/RoomSettingsForm";
import { useRoom } from "../core/room/useRoom";
import { updateRoomSettings } from "../services/roomService";
import type { RoomSettings } from "../types/game";
import React from "react";
import { Button } from "../core/ui/Button";
import { areEqualByValue } from "../utils/state";
import { routes } from "../core/config/routes";

export function SettingsPage() {
  const { room, refresh } = useRoom();
  const [draftSettings, setDraftSettings] = React.useState<RoomSettings | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");

  const roomSettings = (room?.settings as RoomSettings | undefined) ?? null;

  React.useEffect(() => {
    if (!roomSettings) {
      setDraftSettings(null);
      return;
    }

    setDraftSettings((currentDraft) => {
      if (!currentDraft || areEqualByValue(currentDraft, roomSettings)) {
        return roomSettings;
      }

      return currentDraft;
    });
  }, [roomSettings]);

  if (!room) {
    return <AppLayout title="Настройки комнаты">Комната не найдена.</AppLayout>;
  }

  if (!draftSettings) {
    return <AppLayout title="Настройки комнаты">Загрузка настроек...</AppLayout>;
  }

  const hasChanges = !areEqualByValue(draftSettings, roomSettings);
  const currentGameId = room.current_game ?? "mafia";
  const roomJoinUrl =
    window.location.origin +
    import.meta.env.BASE_URL +
    `#${routes.gameJoin(currentGameId, room.code)}`;

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");

    try {
      await updateRoomSettings(room.id, draftSettings);
      await refresh();
      setStatusMessage("Настройки сохранены");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Не удалось сохранить настройки"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppLayout
      title="Настройки комнаты"
      subtitle="Параметры комнаты Abdulkadyrov Games"
      actions={
        <Button
          disabled={!hasChanges || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? "Сохранение..." : "Сохранить"}
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <RoomSettingsForm
            settings={draftSettings}
            onChange={setDraftSettings}
          />
          {statusMessage ? (
            <p className="mt-4 text-sm font-semibold text-white/70">{statusMessage}</p>
          ) : null}
        </Card>
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
