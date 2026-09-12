import { useState, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A styled stand-in for window.confirm — used for Reset/Finalizar/Borrar and similar destructive actions. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-3"
      onClick={onCancel}
    >
      <div
        className="animate-sheet-up flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-slate-900/95 p-5 shadow-2xl ring-1 ring-white/10 sm:rounded-3xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="-mt-1 mb-1 flex justify-center sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-white/15" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {message && <p className="mt-1 text-sm text-slate-400">{message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white/8 px-4 py-2.5 font-semibold text-white transition-transform touch-manipulation active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'rounded-full px-4 py-2.5 font-bold shadow-lg transition-transform touch-manipulation active:scale-95',
              danger ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-amber-500 text-slate-900 shadow-amber-500/20',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type AskOptions = Omit<ConfirmDialogProps, 'onConfirm' | 'onCancel'>;

/** `if (await ask({ title, message, danger })) { ...do the thing... }` — a styled, promise-based window.confirm. */
export function useConfirmDialog() {
  const [pending, setPending] = useState<{ options: AskOptions; resolve: (value: boolean) => void } | null>(null);

  function ask(options: AskOptions): Promise<boolean> {
    return new Promise((resolve) => setPending({ options, resolve }));
  }

  const dialog: ReactNode = pending ? (
    <ConfirmDialog
      {...pending.options}
      onConfirm={() => {
        pending.resolve(true);
        setPending(null);
      }}
      onCancel={() => {
        pending.resolve(false);
        setPending(null);
      }}
    />
  ) : null;

  return { ask, dialog };
}
