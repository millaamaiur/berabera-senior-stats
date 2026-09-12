import { useState } from 'react';
import type { Match } from '../domain/types';

interface EditMatchDateModalProps {
  match: Match;
  allMatches: Match[];
  onSave: (date: string) => Promise<void>;
  onClose: () => void;
}

/** Lets you move a match to a different day before it has ever been started. */
export function EditMatchDateModal({ match, allMatches, onSave, onClose }: EditMatchDateModalProps) {
  const [date, setDate] = useState(match.date);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (allMatches.some((m) => m.id !== match.id && m.date === date)) {
      setError('Ya hay un partido programado ese día. Solo puede haber uno por día.');
      return;
    }
    setSaving(true);
    await onSave(date);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-slate-900/95 p-4 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Editar fecha del partido</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400" aria-label="Cerrar">
            ×
          </button>
        </div>

        <label className="flex flex-col text-sm text-slate-300">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
            className={[
              'mt-1 rounded-xl bg-white/5 px-3 py-2.5 text-white outline-none',
              error ? 'ring-2 ring-rose-500' : 'ring-1 ring-white/10 focus:ring-2 focus:ring-amber-400',
            ].join(' ')}
          />
          {error && <span className="mt-1 text-xs font-semibold text-rose-400">{error}</span>}
        </label>

        <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/8 px-4 py-2.5 font-semibold text-white transition-transform touch-manipulation active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-amber-500 px-4 py-2.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-95 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
