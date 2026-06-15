import React from "react";

export function useDeveloperMode(requiredTaps = 5) {
  const [tapCount, setTapCount] = React.useState(0);
  const [enabled, setEnabled] = React.useState(false);
  const resetTimerRef = React.useRef<number>();

  const registerTap = React.useCallback(() => {
    window.clearTimeout(resetTimerRef.current);

    setTapCount((currentCount) => {
      const nextCount = currentCount + 1;

      if (nextCount >= requiredTaps) {
        setEnabled((currentValue) => !currentValue);
        return 0;
      }

      resetTimerRef.current = window.setTimeout(() => {
        setTapCount(0);
      }, 1200);

      return nextCount;
    });
  }, [requiredTaps]);

  React.useEffect(() => {
    return () => window.clearTimeout(resetTimerRef.current);
  }, []);

  return {
    enabled,
    tapCount,
    registerTap,
  };
}
