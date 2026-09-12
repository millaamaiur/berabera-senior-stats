import { useToast } from '../stores/useToast';

/** Mounted once at the app root — renders whatever useToast().show(...) last posted. */
export function ToastHost() {
  const message = useToast((s) => s.message);
  const toastId = useToast((s) => s.toastId);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 sm:inset-x-auto sm:left-24 sm:right-6 sm:bottom-6">
      <div
        key={toastId}
        className="animate-toast-in rounded-full bg-slate-900/95 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
      >
        {message}
      </div>
    </div>
  );
}
