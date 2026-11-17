import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLiveMatchStore } from '../stores/useLiveMatchStore';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Offers a freshly deployed version instead of swapping it in silently. Until
 * accepted, the current version keeps working from its own cache, so a deploy
 * can't break a page that's open mid-match. Hidden while the match clock runs —
 * updating means reloading.
 */
export function UpdatePrompt() {
  const matchRunning = useLiveMatchStore((s) => s.match?.clock.running ?? false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // A PWA left open for days would otherwise only look for updates when relaunched.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update().catch(() => {}), CHECK_EVERY_MS);
    },
  });

  async function handleUpdate() {
    await updateServiceWorker(true);
    // updateServiceWorker reloads once the new version takes control of the page —
    // which never happens for a page the old version wasn't controlling yet (its
    // very first visit). Reload anyway; the new version is active by then.
    setTimeout(() => window.location.reload(), 1500);
  }

  if (!needRefresh || matchRunning) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-panel/95 p-3 shadow-2xl ring-1 ring-amber-500/40 backdrop-blur-xl">
      <p className="text-sm font-semibold text-white">Hay una versión nueva de la app</p>
      <button
        type="button"
        onClick={() => void handleUpdate()}
        className="shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 transition-transform touch-manipulation active:scale-95"
      >
        Actualizar
      </button>
    </div>
  );
}
