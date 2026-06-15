import React from "react";

export function useCountdown(endsAt?: number): number {
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    getSecondsLeft(endsAt)
  );

  React.useEffect(() => {
    setSecondsLeft(getSecondsLeft(endsAt));

    if (!endsAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft(getSecondsLeft(endsAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [endsAt]);

  return secondsLeft;
}

function getSecondsLeft(endsAt?: number): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}
