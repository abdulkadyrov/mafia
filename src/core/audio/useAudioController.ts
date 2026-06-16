import React from "react";
import { audioAssets, type AudioAssetKey } from "./audioAssets";

const STORAGE_KEY = "agames-audio-settings";

type AudioSettings = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
};

function readSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { musicEnabled: true, sfxEnabled: true };
    }

    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicEnabled: parsed.musicEnabled ?? true,
      sfxEnabled: parsed.sfxEnabled ?? true,
    };
  } catch {
    return { musicEnabled: true, sfxEnabled: true };
  }
}

export function useAudioController() {
  const [settings, setSettings] = React.useState<AudioSettings>(() =>
    typeof window === "undefined"
      ? { musicEnabled: true, sfxEnabled: true }
      : readSettings()
  );
  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  const sfxRef = React.useRef<HTMLAudioElement | null>(null);
  const unlockedRef = React.useRef(false);
  const currentMusicKeyRef = React.useRef<AudioAssetKey | null>(null);

  React.useEffect(() => {
    musicRef.current = new Audio();
    musicRef.current.loop = true;
    musicRef.current.volume = 0.6;

    sfxRef.current = new Audio();
    sfxRef.current.loop = false;
    sfxRef.current.volume = 0.9;

    return () => {
      musicRef.current?.pause();
      sfxRef.current?.pause();
      musicRef.current = null;
      sfxRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    if (musicRef.current) {
      musicRef.current.muted = !settings.musicEnabled;
    }

    if (sfxRef.current) {
      sfxRef.current.muted = !settings.sfxEnabled;
    }
  }, [settings]);

  React.useEffect(() => {
    async function unlockAudio() {
      if (unlockedRef.current) {
        return;
      }

      try {
        if (!sfxRef.current) {
          unlockedRef.current = true;
          return;
        }

        sfxRef.current.src = audioAssets.intro;
        sfxRef.current.muted = true;
        await sfxRef.current.play();
        sfxRef.current.pause();
        sfxRef.current.currentTime = 0;
        sfxRef.current.muted = !settings.sfxEnabled;
      } catch {
        // ignore browser autoplay guard failure
      } finally {
        unlockedRef.current = true;
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [settings.sfxEnabled]);

  const playMusic = React.useCallback(async (key: AudioAssetKey | null) => {
    const music = musicRef.current;

    if (!music) {
      return;
    }

    if (!key || !settings.musicEnabled) {
      music.pause();
      music.currentTime = 0;
      currentMusicKeyRef.current = null;
      return;
    }

    if (currentMusicKeyRef.current === key && !music.paused) {
      return;
    }

    try {
      music.pause();
      music.currentTime = 0;
      music.src = audioAssets[key];
      music.loop = true;
      currentMusicKeyRef.current = key;
      await music.play();
    } catch {
      // autoplay restrictions are acceptable until user gesture
    }
  }, [settings.musicEnabled]);

  const stopMusic = React.useCallback(() => {
    const music = musicRef.current;

    if (!music) {
      return;
    }

    music.pause();
    music.currentTime = 0;
    currentMusicKeyRef.current = null;
  }, []);

  const playSfx = React.useCallback(
    async (key: AudioAssetKey) => {
      const sfx = sfxRef.current;

      if (!sfx || !settings.sfxEnabled) {
        return;
      }

      try {
        sfx.pause();
        sfx.currentTime = 0;
        sfx.src = audioAssets[key];
        sfx.loop = false;
        await sfx.play();
      } catch {
        // autoplay restrictions are acceptable until user gesture
      }
    },
    [settings.sfxEnabled]
  );

  return {
    musicEnabled: settings.musicEnabled,
    sfxEnabled: settings.sfxEnabled,
    setMusicEnabled: (value: boolean) =>
      setSettings((current) => ({ ...current, musicEnabled: value })),
    setSfxEnabled: (value: boolean) =>
      setSettings((current) => ({ ...current, sfxEnabled: value })),
    playMusic,
    stopMusic,
    playSfx,
  };
}
