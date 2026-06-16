import { appConfig } from "../core/config/appConfig";
import { routes } from "../core/config/routes";
import { AppLayout } from "../core/layout/AppLayout";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { isSupabaseConfigured } from "../core/supabase/client";

export function HomePage({
  navigate,
  onLogout,
}: {
  navigate: (path: string) => void;
  onLogout: () => void;
}) {
  return (
    <AppLayout
      title={appConfig.appName}
      subtitle="Главный экран платформы"
      actions={
        <Button variant="ghost" onClick={onLogout}>
          Выйти из аккаунта
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="text-2xl font-black text-white">Быстрый старт</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate(routes.gamesHub)}>
              Открыть игры
            </Button>
            <Button onClick={() => navigate(routes.launch())}>Быстрый старт</Button>
          </div>
          <p className="mt-4 text-sm font-semibold text-white/70">
            Откройте список игр или сразу создайте комнату и перейдите в нужный
            игровой модуль.
          </p>
        </Card>

        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
            Статус Supabase
          </p>
          <p className="mt-3 text-2xl font-black text-white">
            {isSupabaseConfigured() ? "Подключено" : "Не настроено"}
          </p>
          <p className="mt-3 text-sm font-semibold text-white/65">
            Realtime работает адресно и больше не должен дёргать весь интерфейс
            каждые 1–2 секунды.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
            Доступные игры
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              "Mafia",
              "Кто хочет стать миллионером",
              "Alias",
            ].map((game) => (
              <div
                key={game}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white/80"
              >
                {game}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
