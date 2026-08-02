import React from "react";
import { useCountdown } from "../../hooks/useCountdown";

export function PhaseTimer({ endsAt, onExpire }: { endsAt: string | null; onExpire?: () => void }) {
  const milliseconds = endsAt ? new Date(endsAt).getTime() : undefined;
  const seconds = useCountdown(milliseconds);
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    firedRef.current = false;
  }, [endsAt]);
  React.useEffect(() => {
    if (endsAt && seconds === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [endsAt, onExpire, seconds]);
  return <time className="mafia-phase-timer" dateTime={`PT${seconds}S`}>{format(seconds)}</time>;
}

function format(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
