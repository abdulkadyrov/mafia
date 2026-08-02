import React from "react";
import { audioAssets, type AudioAssetKey } from "./audioAssets";

const STORAGE_KEY = "agames-audio-settings";

export type AudioSettings = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  allMuted: boolean;
};

const defaultSettings: AudioSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.85,
  voiceVolume: 1,
  allMuted: false,
};

function readSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicEnabled: parsed.musicEnabled ?? true,
      sfxEnabled: parsed.sfxEnabled ?? true,
      masterVolume: clamp(parsed.masterVolume ?? defaultSettings.masterVolume),
      musicVolume: clamp(parsed.musicVolume ?? defaultSettings.musicVolume),
      sfxVolume: clamp(parsed.sfxVolume ?? defaultSettings.sfxVolume),
      voiceVolume: clamp(parsed.voiceVolume ?? defaultSettings.voiceVolume),
      allMuted: parsed.allMuted ?? false,
    };
  } catch {
    return defaultSettings;
  }
}

export function useAudioController() {
  const [settings, setSettings] = React.useState<AudioSettings>(() =>
    typeof window === "undefined"
      ? defaultSettings
      : readSettings()
  );
  const musicRef = React.useRef<HTMLAudioElement | null>(null);
  const sfxRef = React.useRef<HTMLAudioElement | null>(null);
  const unlockedRef = React.useRef(false);
  const currentMusicKeyRef = React.useRef<AudioAssetKey | null>(null);

  React.useEffect(() => {
    musicRef.current = new Audio();
    musicRef.current.loop = true;
    musicRef.current.volume = defaultSettings.masterVolume * defaultSettings.musicVolume;

    sfxRef.current = new Audio();
    sfxRef.current.loop = false;
    sfxRef.current.volume = defaultSettings.masterVolume * defaultSettings.sfxVolume;

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
      musicRef.current.muted = settings.allMuted || !settings.musicEnabled;
      musicRef.current.volume = settings.masterVolume * settings.musicVolume;
    }

    if (sfxRef.current) {
      sfxRef.current.muted = settings.allMuted || !settings.sfxEnabled;
      sfxRef.current.volume = settings.masterVolume * settings.sfxVolume;
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
        sfxRef.current.muted = settings.allMuted || !settings.sfxEnabled;
        if (currentMusicKeyRef.current && musicRef.current && settings.musicEnabled && !settings.allMuted) {
          await musicRef.current.play().catch(() => undefined);
        }
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
  }, [settings.allMuted, settings.musicEnabled, settings.sfxEnabled]);

  const playMusic = React.useCallback(async (key: AudioAssetKey | null) => {
    const music = musicRef.current;

    if (!music) {
      return;
    }

    if (!key || !settings.musicEnabled || settings.allMuted) {
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
  }, [settings.allMuted, settings.musicEnabled]);

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

      if (!sfx || !settings.sfxEnabled || settings.allMuted) {
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
    [settings.allMuted, settings.sfxEnabled]
  );

  return {
    musicEnabled: settings.musicEnabled,
    sfxEnabled: settings.sfxEnabled,
    masterVolume: settings.masterVolume,
    musicVolume: settings.musicVolume,
    sfxVolume: settings.sfxVolume,
    voiceVolume: settings.voiceVolume,
    allMuted: settings.allMuted,
    setMusicEnabled: (value: boolean) =>
      setSettings((current) => ({ ...current, musicEnabled: value })),
    setSfxEnabled: (value: boolean) =>
      setSettings((current) => ({ ...current, sfxEnabled: value })),
    setMasterVolume: (value: number) => setSettings((current) => ({ ...current, masterVolume: clamp(value) })),
    setMusicVolume: (value: number) => setSettings((current) => ({ ...current, musicVolume: clamp(value) })),
    setSfxVolume: (value: number) => setSettings((current) => ({ ...current, sfxVolume: clamp(value) })),
    setVoiceVolume: (value: number) => setSettings((current) => ({ ...current, voiceVolume: clamp(value) })),
    setAllMuted: (value: boolean) => setSettings((current) => ({ ...current, allMuted: value })),
    playMusic,
    stopMusic,
    playSfx,
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
