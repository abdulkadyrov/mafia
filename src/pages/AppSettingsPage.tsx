import { logout } from "../core/auth/authStorage";
import { appConfig } from "../core/config/appConfig";
import { AppLayout } from "../core/layout/AppLayout";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { getSupabaseConfigError, isSupabaseConfigured } from "../core/supabase/client";

export function AppSettingsPage({
  onLogout,
}: {
  onLogout: () => void;
}) {
  return (
    <AppLayout title="Настройки" subtitle="Общие настройки платформы">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
            Supabase
          </p>
          <p className="mt-3 text-2xl font-black text-white">
            {isSupabaseConfigured() ? "Подключено" : "Не настроено"}
          </p>
          {getSupabaseConfigError() ? (
            <p className="mt-3 text-sm font-semibold text-amber-100">
              {getSupabaseConfigError()}
            </p>
          ) : null}
        </Card>

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
    </AppLayout>
  );
}
