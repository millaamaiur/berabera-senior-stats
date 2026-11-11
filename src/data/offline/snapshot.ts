const PREFIX = 'bbs:snapshot:';

/** Last known-good copy of a collection, used to keep the app usable with no connection. */
export function saveSnapshot<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(items));
  } catch {
    // storage full/unavailable — the app still works, it just has no offline fallback this time.
  }
}

/** Wipes every stored collection — called whenever the app is locked, so a locked device keeps no copy of the stats. */
export function clearSnapshots(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable — nothing was stored there either.
  }
}

export function loadSnapshot<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
