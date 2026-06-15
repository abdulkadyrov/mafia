type LogoMarkProps = {
  onPress?: () => void;
};

export function LogoMark({ onPress }: LogoMarkProps) {
  return (
    <button
      type="button"
      aria-label="Mafia"
      className="group flex items-center gap-3 text-left"
      onClick={onPress}
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-xl font-black text-white shadow-[0_18px_45px_rgba(139,92,246,0.35)] transition group-active:scale-95">
        M
      </span>
      <span>
        <span className="block text-2xl font-black tracking-normal text-text">
          Mafia
        </span>
        <span className="block text-xs font-medium uppercase tracking-[0.2em] text-muted">
          LAN PWA
        </span>
      </span>
    </button>
  );
}
