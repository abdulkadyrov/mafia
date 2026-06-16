import { AppLayout } from "../core/layout/AppLayout";
import { Card } from "../core/ui/Card";
import { TeamManager } from "../core/teams/TeamManager";
import { QrCodeCard } from "../core/qr/QrCodeCard";
import { useRoom } from "../core/room/useRoom";
import React from "react";
import { routes } from "../core/config/routes";
import { ImportJsonPack } from "../core/packs/ImportJsonPack";
import { Tabs } from "../core/ui/Tabs";

export function SettingsPage() {
  const { room } = useRoom();
  const [packGame, setPackGame] = React.useState<"millionaire" | "alias">(
    "millionaire"
  );

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
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <Tabs
            value={packGame}
            onChange={setPackGame}
            items={[
              { value: "millionaire", label: "Millionaire" },
              { value: "alias", label: "Alias" },
            ]}
          />
          <div className="mt-4">
            <ImportJsonPack roomId={currentRoom.id} initialGame={packGame} />
          </div>
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
