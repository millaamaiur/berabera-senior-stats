import { useState } from 'react';
import { useAppData } from '../stores/useAppData';
import { useToast } from '../stores/useToast';
import { flushQueue } from '../data/offline/queue';

/**
 * Downloads every player, match, event and season as one JSON file — a copy of
 * the stats kept off Supabase, in case anything ever happens to the project.
 */
export function BackupButton() {
  const [working, setWorking] = useState(false);

  async function handleDownload() {
    setWorking(true);
    try {
      // Freshest possible copy: upload anything pending, then re-read. Offline,
      // reload falls back to the local snapshot plus pending writes — still complete.
      await flushQueue();
      await useAppData.getState().reload();
      const { players, matches, events, seasons } = useAppData.getState();
      const exportedAt = new Date();
      const backup = { app: 'berabera-senior-stats', version: 1, exportedAt: exportedAt.toISOString(), players, matches, events, seasons };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `berabera-copia-${exportedAt.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      useToast.getState().show(`Copia descargada: ${matches.length} partidos, ${events.length} acciones`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={working}
      className="rounded-full bg-white/8 px-4 py-2.5 text-sm font-bold text-slate-200 transition-transform touch-manipulation active:scale-95 disabled:opacity-40"
    >
      {working ? 'Preparando copia…' : 'Descargar copia de seguridad'}
    </button>
  );
}
