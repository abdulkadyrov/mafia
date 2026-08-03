import { MafiaStartScreen } from "../features/room/MafiaStartScreen";

export function StartPage({
  navigate,
}: {
  navigate: (path: string) => void;
  targetGameId?: string;
}) {
  return <MafiaStartScreen navigate={navigate} />;
}
