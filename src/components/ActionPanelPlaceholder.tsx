const LABELS = ['Lanzamiento', 'Penalti', 'Pérdida', 'Recuperación', 'Pasos', 'Amonestación'];

/** Shown instead of the real action panel while no player is selected — same
 * shape as the real thing, just greyed out, so the screen never looks empty. */
export function ActionPanelPlaceholder() {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-center text-sm text-slate-500">Selecciona un jugador para registrar una acción</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LABELS.map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="h-20 cursor-not-allowed rounded-2xl bg-white/5 text-lg font-bold text-slate-600 ring-1 ring-white/5"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
