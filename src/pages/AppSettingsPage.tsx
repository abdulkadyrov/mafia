import { logout } from "../core/auth/authStorage";
import { appConfig } from "../core/config/appConfig";
import { AppLayout } from "../core/layout/AppLayout";
import { ImportJsonPack } from "../core/packs/ImportJsonPack";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { getSessionSnapshot } from "../utils/storage";

export function AppSettingsPage({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const session = getSessionSnapshot();

  return (
    <AppLayout title="Настройки" subtitle="Общие настройки платформы">
      <div className="grid gap-4">
        {session.roomId ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                Кто хочет стать миллионером
              </p>
              <div className="mt-4">
                <ImportJsonPack roomId={session.roomId} initialGame="millionaire" />
              </div>
            </Card>

            <Card>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                Alias
              </p>
              <div className="mt-4">
                <ImportJsonPack roomId={session.roomId} initialGame="alias" />
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Игровые настройки
            </p>
            <p className="mt-3 text-sm font-semibold text-white/70">
              Сначала войдите в комнату или создайте комнату, и тогда здесь появятся
              шаблоны и сохранение тем для Millionaire и Alias.
            </p>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
            Данные приложения
          </p>
          <div className="mt-4 grid gap-3">
            <Button
              onClick={() => {
                window.localStorage.clear();
                onLogout();
              }}
            >
              Очистить localStorage
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                onLogout();
              }}
            >
              Выйти из аккаунта
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
            Версия
          </p>
          <p className="mt-3 text-sm font-semibold text-white/70">
            {appConfig.appName} · {appConfig.repoName} · v0.1.0
          </p>
        </Card>
        </div>
      </div>
    </AppLayout>
  );
}
