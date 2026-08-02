import React from "react";
import { logout } from "../core/auth/authStorage";
import { appConfig } from "../core/config/appConfig";
import { AppLayout } from "../core/layout/AppLayout";
import { LocalPackManager } from "../core/packs/LocalPackManager";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { useMafiaAudio } from "../core/audio/MafiaAudioProvider";
import { useAuth } from "../core/auth/useAuth";
import { Avatar } from "../core/ui/Avatar";

export function AppSettingsPage({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const audio = useMafiaAudio();
  const auth = useAuth();
  const [displayName, setDisplayName] = React.useState(auth.profile?.displayName ?? "");
  const [profileStatus, setProfileStatus] = React.useState("");

  async function updateProfile(action: () => Promise<unknown>, success: string) {
    setProfileStatus("");
    try {
      await action();
      setProfileStatus(success);
    } catch (caught) {
      setProfileStatus(caught instanceof Error ? caught.message : "Не удалось обновить профиль");
    }
  }

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
        <Card className="lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Профиль Mafia</p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
            <Avatar name={auth.profile?.displayName ?? "Игрок"} url={auth.profile?.avatarUrl} size="large" />
            <div className="grid flex-1 gap-3 md:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm font-bold text-white/80"><span>Имя игрока</span><input className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white" maxLength={32} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
              <Button onClick={() => void updateProfile(() => auth.saveDisplayName(displayName), "Имя сохранено")}>Сохранить имя</Button>
              <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-center text-sm font-bold text-white/80"><span>Загрузить аватар</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void updateProfile(() => auth.updateAvatar(file), "Аватар обновлён"); event.target.value = ""; }} /></label>
              <Button variant="ghost" onClick={() => void updateProfile(auth.removeAvatar, "Аватар удалён")}>Удалить аватар</Button>
            </div>
          </div>
          {profileStatus ? <p className="mt-3 text-sm text-white/70" role="status">{profileStatus}</p> : null}
        </Card>
        <Card className="lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Звук Mafia</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <AudioRange label="Общая громкость" value={audio.masterVolume} onChange={audio.setMasterVolume} />
            <AudioRange label="Музыка" value={audio.musicVolume} onChange={audio.setMusicVolume} />
            <AudioRange label="Эффекты" value={audio.sfxVolume} onChange={audio.setSfxVolume} />
            <AudioRange label="Голосовой чат" value={audio.voiceVolume} onChange={audio.setVoiceVolume} />
            <label className="flex items-center gap-3 text-sm font-bold text-white/80"><input type="checkbox" checked={audio.musicEnabled} onChange={(event) => audio.setMusicEnabled(event.target.checked)} /> Музыка включена</label>
            <label className="flex items-center gap-3 text-sm font-bold text-white/80"><input type="checkbox" checked={audio.sfxEnabled} onChange={(event) => audio.setSfxEnabled(event.target.checked)} /> Эффекты включены</label>
            <label className="flex items-center gap-3 text-sm font-bold text-white/80 md:col-span-2"><input type="checkbox" checked={audio.allMuted} onChange={(event) => audio.setAllMuted(event.target.checked)} /> Выключить весь звук</label>
          </div>
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
      </div>
    </AppLayout>
  );
}

function AudioRange({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-2 text-sm font-bold text-white/80"><span>{label}: {Math.round(value * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
