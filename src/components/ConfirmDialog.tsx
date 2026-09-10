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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onCancel}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {message && <p className="mt-1 text-sm text-slate-400">{message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'rounded-lg px-4 py-2 font-bold',
              danger ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-900',
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
