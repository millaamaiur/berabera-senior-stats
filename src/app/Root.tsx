import { Suspense, useCallback, useEffect, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ToastHost } from '../components/ToastHost';
import { PullToRefresh } from '../components/PullToRefresh';
import { PinLock } from '../components/PinLock';
import { ClubLogo } from '../components/ClubLogo';
import { useAppData } from '../stores/useAppData';
import { useAuthStore } from '../stores/useAuthStore';
import { initOfflineSync, flushQueue } from '../data/offline/queue';

export function Root() {
  const reload = useAppData((s) => s.reload);
  const clearData = useAppData((s) => s.clear);
  const loaded = useAppData((s) => s.loaded);
  const initAuth = useAuthStore((s) => s.init);
  const authReady = useAuthStore((s) => s.ready);
  const unlocked = useAuthStore((s) => s.unlocked);
  const location = useLocation();
  const isLiveScoring = location.pathname.startsWith('/anotar');

  useEffect(() => {
    initAuth();
    initOfflineSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The whole app is private (Supabase RLS enforces it too): data only loads
  // once unlocked, and is wiped — offline snapshot included — whenever it isn't,
  // so a device that's been locked, or never unlocked, keeps no copy of it.
  useEffect(() => {
    if (!authReady) return;
    if (unlocked) void flushQueue().finally(() => reload());
    else clearData();
  }, [authReady, unlocked, reload, clearData]);

  const handleRefresh = useCallback(async () => {
    await flushQueue();
    await reload();
  }, [reload]);

  if (!authReady) {
    return (
      <Shell>
        <LoadingScreen />
      </Shell>
    );
  }

  if (!unlocked) {
    return (
      <Shell>
        <div className="flex h-full w-full flex-col items-center justify-center">
          <ClubLogo className="h-20 w-20 object-contain" />
          <div>
            <PinLock message="Introduce el PIN para entrar" />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="order-1 min-h-0 flex-1 sm:order-2">
        <PullToRefresh onRefresh={handleRefresh} disabled={isLiveScoring} className="h-full overflow-y-auto pb-24 sm:pb-0">
          {loaded ? (
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          ) : (
            <LoadingScreen />
          )}
        </PullToRefresh>
      </main>
      <NavBar />
      <ToastHost />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--app-bg)] text-white sm:flex-row">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(60% 40% at 15% 0%, rgba(245,158,11,0.10), transparent), radial-gradient(50% 35% at 100% 20%, rgba(56,189,248,0.08), transparent)',
        }}
      />
      {children}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 text-slate-400">
      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500" />
    </div>
  );
}
