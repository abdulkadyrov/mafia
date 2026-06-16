import { AppLayout } from "../core/layout/AppLayout";
import { ImportJsonPack } from "../core/packs/ImportJsonPack";
import { useRoom } from "../core/room/useRoom";

export function ImportPackPage() {
  const { room } = useRoom();

  return (
    <AppLayout
      title="Импорт JSON-паков"
      subtitle="Загрузите пакет для Millionaire или Alias"
    >
      {room ? (
        <ImportJsonPack roomId={room.id} />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
          Комната не найдена.
        </div>
      )}
    </AppLayout>
  );
}

