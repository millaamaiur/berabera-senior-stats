const PREFIX = 'bbs:snapshot:';

/** Last known-good copy of a collection, used to keep the app usable with no connection. */
export function saveSnapshot<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(items));
  } catch {
    // storage full/unavailable — the app still works, it just has no offline fallback this time.
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
