import React from "react";
import { imageSet, mafiaImages, type MafiaBackgroundName } from "../media/imageManifest";
import { preloadMafiaBackground } from "../media/imagePreloader";

type BackgroundStyle = React.CSSProperties & {
  "--mafia-bg-phone": string;
  "--mafia-bg-tablet": string;
  "--mafia-bg-desktop": string;
};

export function MafiaBackground({ name, className = "" }: { name: MafiaBackgroundName; className?: string }) {
  const sources = mafiaImages.background(name);
  React.useEffect(() => preloadMafiaBackground(name), [name]);
  const style: BackgroundStyle = {
    "--mafia-bg-phone": imageSet(sources.phone),
    "--mafia-bg-tablet": imageSet(sources.tablet),
    "--mafia-bg-desktop": imageSet(sources.desktop),
  };
  return <div className={`mafia-cinematic-bg ${className}`} style={style} aria-hidden="true" />;
}
