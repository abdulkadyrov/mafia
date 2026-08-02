import React from "react";
import { useAudioController } from "./useAudioController";

type MafiaAudioContextValue = ReturnType<typeof useAudioController>;
const MafiaAudioContext = React.createContext<MafiaAudioContextValue | null>(null);

export function MafiaAudioProvider({ children }: { children: React.ReactNode }) {
  const audio = useAudioController();
  return <MafiaAudioContext.Provider value={audio}>{children}</MafiaAudioContext.Provider>;
}

export function useMafiaAudio() {
  const value = React.useContext(MafiaAudioContext);
  if (!value) throw new Error("useMafiaAudio должен использоваться внутри MafiaAudioProvider");
  return value;
}
