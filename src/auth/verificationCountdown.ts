import { useEffect, useState } from "react";

export interface VerificationTiming {
  expires_in_seconds?: number | null;
  resend_in_seconds?: number;
}

interface Deadlines {
  expiresAt: number | null;
  resendAt: number;
  estimated?: boolean;
}

export function verificationDeadlines(startedAt = Date.now(), estimated = false): Deadlines {
  return { expiresAt: startedAt + 600_000, resendAt: startedAt + 60_000, estimated };
}

export function deadlinesFromServer(timing?: VerificationTiming): Deadlines | null {
  if (!timing || timing.expires_in_seconds === undefined) return null;
  const now = Date.now();
  return {
    expiresAt: timing.expires_in_seconds === null ? null : now + timing.expires_in_seconds * 1000,
    resendAt: now + (timing.resend_in_seconds ?? 0) * 1000,
  };
}

export function useVerificationCountdown(deadlines: Deadlines | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!deadlines) return;
    const lastDeadline = Math.max(deadlines.expiresAt ?? 0, deadlines.resendAt);
    let timer: number | undefined;
    function tick() {
      window.clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      if (current < lastDeadline) timer = window.setTimeout(tick, Math.min(1000, lastDeadline - current));
    }
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [deadlines]);

  const secondsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - Math.max(now, Date.now())) / 1000));
  const expires = deadlines?.expiresAt == null ? null : secondsLeft(deadlines.expiresAt);
  const resend = deadlines ? secondsLeft(deadlines.resendAt) : 0;
  return { expires, resend, expired: expires === 0 && !deadlines?.estimated, estimated: deadlines?.estimated };
}
