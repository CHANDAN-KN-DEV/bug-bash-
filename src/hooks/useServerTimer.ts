import { useState, useEffect, useRef, useCallback } from 'react';

interface UseServerTimerProps {
  endsAt: string | null;
  onTimeExpired?: () => void;
  enabled?: boolean;
}

export function useServerTimer({ endsAt, onTimeExpired, enabled = true }: UseServerTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!endsAt) return 0;
    const diff = Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  const [isExpired, setIsExpired] = useState<boolean>(false);
  const expiredHandledRef = useRef<boolean>(false);

  // Sync with endsAt whenever endsAt changes
  const calculateRemaining = useCallback(() => {
    if (!endsAt || !enabled) {
      setSecondsRemaining(0);
      return;
    }
    const endMs = new Date(endsAt).getTime();
    const nowMs = Date.now();
    const remaining = Math.max(0, Math.floor((endMs - nowMs) / 1000));
    setSecondsRemaining(remaining);

    if (remaining <= 0) {
      setIsExpired(true);
      if (!expiredHandledRef.current) {
        expiredHandledRef.current = true;
        onTimeExpired?.();
      }
    } else {
      setIsExpired(false);
      expiredHandledRef.current = false;
    }
  }, [endsAt, enabled, onTimeExpired]);

  useEffect(() => {
    calculateRemaining();

    if (!enabled || !endsAt) return;

    const interval = setInterval(() => {
      calculateRemaining();
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, enabled, endsAt]);

  const formattedTime = () => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Color coding: normal > 5m, warning <= 5m, danger <= 1m
  const timerStatus: 'normal' | 'warning' | 'danger' = 
    secondsRemaining <= 60 ? 'danger' : secondsRemaining <= 300 ? 'warning' : 'normal';

  return {
    secondsRemaining,
    formattedTime: formattedTime(),
    isExpired,
    timerStatus,
    reSync: calculateRemaining,
  };
}

