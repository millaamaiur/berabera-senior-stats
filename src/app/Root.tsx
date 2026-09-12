import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useAppData } from '../stores/useAppData';
import { useAuthStore } from '../stores/useAuthStore';
import { initOfflineSync } from '../data/offline/queue';

export function Root() {
  const reload = useAppData((s) => s.reload);
  const loaded = useAppData((s) => s.loaded);
  const initAuth = useAuthStore((s) => s.init);

  useEffect(() => {
    reload();
    initAuth();
    initOfflineSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-slate-950 text-white sm:flex-row">
      <NavBar />
      <main className="flex-1 overflow-y-auto">{loaded ? <Outlet /> : <LoadingScreen />}</main>
    </div>
  );
}

function LoadingScreen() {
  return <div className="flex h-full items-center justify-center text-slate-400">Cargando...</div>;
}
