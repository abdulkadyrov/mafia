import { useMafiaAudio } from "../../core/audio/MafiaAudioProvider";

export function AudioSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const audio = useMafiaAudio();
  if (!open) return null;
  return (
    <div className="mafia-modal-backdrop" onMouseDown={onClose}>
      <section className="mafia-modal mafia-audio-modal" role="dialog" aria-modal="true" aria-labelledby="audio-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="mafia-modal-close" onClick={onClose} aria-label="Закрыть громкость">×</button>
        <span className="mafia-eyebrow">Звук игры</span>
        <h2 id="audio-title">Громкость</h2>
        <VolumeSlider label="Общая громкость" value={audio.masterVolume} onChange={audio.setMasterVolume} />
        <VolumeSlider label="Музыка" value={audio.musicVolume} onChange={audio.setMusicVolume} disabled={!audio.musicEnabled} />
        <VolumeSlider label="Звуковые эффекты" value={audio.sfxVolume} onChange={audio.setSfxVolume} disabled={!audio.sfxEnabled} />
        <VolumeSlider label="Голоса игроков" value={audio.voiceVolume} onChange={audio.setVoiceVolume} />
        <div className="mafia-audio-toggles">
          <label><input type="checkbox" checked={audio.musicEnabled} onChange={(event) => audio.setMusicEnabled(event.target.checked)} /> Музыка</label>
          <label><input type="checkbox" checked={audio.sfxEnabled} onChange={(event) => audio.setSfxEnabled(event.target.checked)} /> Эффекты</label>
        </div>
        <button className={audio.allMuted ? "mafia-primary-button" : "mafia-secondary-button"} onClick={() => audio.setAllMuted(!audio.allMuted)}>
          {audio.allMuted ? "Включить весь звук" : "Выключить весь звук"}
        </button>
      </section>
    </div>
  );
}

function VolumeSlider({ label, value, onChange, disabled = false }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mafia-volume-control">
      <span><strong>{label}</strong><output>{Math.round(value * 100)}%</output></span>
      <input type="range" min="0" max="1" step="0.01" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
