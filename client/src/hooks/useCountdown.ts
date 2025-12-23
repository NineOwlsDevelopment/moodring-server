import { useState, useEffect } from "react";

/**
 * Hook that returns the time remaining until a target timestamp
 * @param targetTimestamp - Unix timestamp in seconds
 * @returns Object with time remaining in various formats and whether the countdown has ended
 */
export const useCountdown = (targetTimestamp: number | null | undefined) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    total: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    hasEnded: boolean;
  }>({
    total: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    hasEnded: true,
  });

  useEffect(() => {
    if (!targetTimestamp) {
      setTimeRemaining({
        total: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        hasEnded: true,
      });
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const target = targetTimestamp;
      const diff = target - now;

      if (diff <= 0) {
        setTimeRemaining({
          total: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          hasEnded: true,
        });
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setTimeRemaining({
        total: diff,
        days,
        hours,
        minutes,
        seconds,
        hasEnded: false,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return timeRemaining;
};
