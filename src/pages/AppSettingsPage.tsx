import { logout } from "../core/auth/authStorage";
import { appConfig } from "../core/config/appConfig";
import { AppLayout } from "../core/layout/AppLayout";
import { LocalPackManager } from "../core/packs/LocalPackManager";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";

export function AppSettingsPage({
  onLogout,
}: {
  onLogout: () => void;
}) {
  return (
    <AppLayout title="Настройки" subtitle="Общие настройки платформы">
      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Кто хочет стать миллионером
            </p>
            <div className="mt-4">
              <LocalPackManager game="millionaire" />
            </div>
          </Card>

          <Card>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
              Alias
            </p>
            <div className="mt-4">
              <LocalPackManager game="alias" />
            </div>
          </Card>
        </div>

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
