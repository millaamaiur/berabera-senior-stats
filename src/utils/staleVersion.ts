const STALE_RELOAD_KEY = 'bbs:staleReloadAt';

/** A lazily-loaded screen whose file is gone because a new version was deployed while this page stayed open. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed/i.test(message);
}

/**
 * Reloads to pick up the deployed version. At most once a minute, so a
 * genuinely broken deploy shows the error screen instead of reloading forever.
 * Returns whether it reloaded.
 */
export function reloadForNewVersion(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(STALE_RELOAD_KEY) ?? 0) < 60_000) return false;
    sessionStorage.setItem(STALE_RELOAD_KEY, String(Date.now()));
  } catch {
    // storage unavailable — reload anyway, there's no loop to guard against without it either
  }
  window.location.reload();
  return true;
}
