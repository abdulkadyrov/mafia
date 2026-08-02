import { mafiaImages } from "../media/imageManifest";

export function Avatar({ name, url, size = "medium" }: { name: string; url?: string | null; size?: "small" | "medium" | "large" }) {
  return (
    <div className={`mafia-avatar mafia-avatar--${size}`} aria-label={`Аватар ${name}`}>
      {url ? <img src={url} alt="" loading="lazy" /> : (
        <picture>
          <source srcSet={mafiaImages.defaultAvatar.avif} type="image/avif" />
          <img src={mafiaImages.defaultAvatar.webp} alt="" loading="lazy" />
        </picture>
      )}
      <span className="mafia-avatar-initials" aria-hidden="true">{getInitials(name)}</span>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}
