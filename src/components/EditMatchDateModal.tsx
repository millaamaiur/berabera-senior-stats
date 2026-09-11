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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-slate-700 bg-slate-900 p-4">
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
              'mt-1 rounded-lg border-2 bg-slate-800 px-3 py-2 text-white',
              error ? 'border-rose-500' : 'border-slate-600',
            ].join(' ')}
          />
          {error && <span className="mt-1 text-xs font-semibold text-rose-400">{error}</span>}
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-700 pt-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-900 disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
