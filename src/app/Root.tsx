import { Suspense, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ToastHost } from '../components/ToastHost';
import { PullToRefresh } from '../components/PullToRefresh';
import { useAppData } from '../stores/useAppData';
import { useAuthStore } from '../stores/useAuthStore';
import { initOfflineSync, flushQueue } from '../data/offline/queue';

export function Root() {
  const reload = useAppData((s) => s.reload);
  const loaded = useAppData((s) => s.loaded);
  const initAuth = useAuthStore((s) => s.init);
  const location = useLocation();
  const isLiveScoring = location.pathname.startsWith('/anotar');

  useEffect(() => {
    reload();
    initAuth();
    initOfflineSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    await flushQueue();
    await reload();
  }, [reload]);

  return (
    <div className="relative flex h-dvh w-dvw flex-col overflow-hidden bg-[#06070c] text-white sm:flex-row">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(60% 40% at 15% 0%, rgba(245,158,11,0.10), transparent), radial-gradient(50% 35% at 100% 20%, rgba(56,189,248,0.08), transparent)',
        }}
      />
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
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-slate-400">
      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500" />
    </div>
  );
}
