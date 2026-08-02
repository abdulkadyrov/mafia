import type { MafiaRole } from "../roles/roleTypes";

export type MafiaBackgroundName =
  | "home"
  | "create"
  | "lobby"
  | "night"
  | "day"
  | "voting"
  | "mafia-win"
  | "city-win"
  | "defeat"
  | "results";

type PictureSource = { avif: string; webp: string };
type ResponsiveBackground = Record<"phone" | "tablet" | "desktop", PictureSource>;

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/mafia/${path}`;

export const mafiaImages = {
  background(name: MafiaBackgroundName): ResponsiveBackground {
    return {
      phone: source(`backgrounds/${name}-phone`),
      tablet: source(`backgrounds/${name}-tablet`),
      desktop: source(`backgrounds/${name}-desktop`),
    };
  },
  role(role: MafiaRole): PictureSource {
    return source(`roles/${role}`);
  },
  defaultAvatar: source("avatars/default"),
};

export function imageSet(source: PictureSource): string {
  return `image-set(url("${source.avif}") type("image/avif"), url("${source.webp}") type("image/webp"))`;
}

function source(path: string): PictureSource {
  return { avif: assetUrl(`${path}.avif`), webp: assetUrl(`${path}.webp`) };
}
