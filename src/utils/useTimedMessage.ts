import { useRef, useState } from 'react';

/** A short-lived status message (e.g. a rejection toast) that clears itself after `durationMs`. */
export function useTimedMessage(durationMs = 1800) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(text: string) {
    setMessage(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setMessage(null), durationMs);
  }

  return { message, show };
}
