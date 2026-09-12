import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';

interface PinLockProps {
  message?: string;
}

/** Shown instead of any editing screen until the shared 4-digit PIN is entered. */
export function PinLock({ message = 'Introduce el PIN para anotar' }: PinLockProps) {
  const unlock = useAuthStore((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    const ok = await unlock(pin);
    setLoading(false);
    if (!ok) {
      setError('PIN incorrecto');
      setPin('');
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="text-lg font-semibold text-white">{message}</p>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
          setError(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="w-36 rounded-2xl bg-white/5 px-4 py-3.5 text-center text-3xl tracking-[0.5em] text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-amber-400"
        autoFocus
      />
      {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pin.length !== 4 || loading}
        className="rounded-full bg-amber-500 px-6 py-3.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-95 disabled:opacity-40"
      >
        {loading ? 'Comprobando...' : 'Desbloquear'}
      </button>
    </div>
  );
}
