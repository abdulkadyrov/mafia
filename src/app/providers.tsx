import { AuthProvider } from "../core/auth/AuthProvider";
import { PwaProvider } from "../core/pwa/PwaProvider";
import { MafiaAudioProvider } from "../core/audio/MafiaAudioProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <PwaProvider><MafiaAudioProvider><AuthProvider>{children}</AuthProvider></MafiaAudioProvider></PwaProvider>;
}
