import { mafiaImages, type MafiaBackgroundName } from "./imageManifest";

const requested = new Set<string>();

export function preloadMafiaBackground(name: MafiaBackgroundName): void {
  if (typeof window === "undefined") return;
  const variant = window.matchMedia("(max-width: 640px)").matches
    ? "phone"
    : window.matchMedia("(max-width: 1100px)").matches
      ? "tablet"
      : "desktop";
  preload(mafiaImages.background(name)[variant].webp);
}

export function preloadImage(url: string): void {
  if (typeof window === "undefined") return;
  preload(url);
}

function preload(url: string) {
  if (requested.has(url)) return;
  requested.add(url);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
}
