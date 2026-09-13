import { useState } from 'react';
import type { Match } from '../domain/types';

interface EditMatchLinkModalProps {
  match: Match;
  onSave: (link: string | null) => Promise<void>;
  onClose: () => void;
}

/** Add, change or remove a match's link (a video/highlights recording, most likely) after the fact. */
export function EditMatchLinkModal({ match, onSave, onClose }: EditMatchLinkModalProps) {
  const [link, setLink] = useState(match.link ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = link.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setError('El enlace debe empezar por http:// o https://');
      return;
    }
    setSaving(true);
    await onSave(trimmed || null);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-panel/95 p-4 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Enlace del partido</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400" aria-label="Cerrar">
            ×
          </button>
        </div>

        <label className="flex flex-col text-sm text-slate-300">
          URL (vídeo, resumen, lo que sea)
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setError(null);
            }}
            placeholder="https://..."
            autoFocus
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
