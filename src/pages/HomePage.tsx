import { MafiaHomeScreen } from "../features/home/MafiaHomeScreen";

export function HomePage({
  navigate,
  onLogout,
}: {
  navigate: (path: string) => void;
  onLogout: () => void;
}) {
  return <MafiaHomeScreen navigate={navigate} onLogout={onLogout} />;
}
