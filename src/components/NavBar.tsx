import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ClubLogo } from './ClubLogo';
import { useAuthStore } from '../stores/useAuthStore';
import { useSyncStatus } from '../stores/useSyncStatus';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function HomeIcon() {
  return (
    <svg {...ICON_PROPS} className="h-6 w-6">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...ICON_PROPS} className="h-6 w-6">
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.4-2.1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...ICON_PROPS} className="h-5 w-5">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const TABS: { to: string; label: string; end?: boolean; icon: () => ReactNode }[] = [
  { to: '/', label: 'Inicio', end: true, icon: HomeIcon },
  { to: '/partidos', label: 'Partidos', icon: CalendarIcon },
];

export function NavBar() {
  const unlocked = useAuthStore((s) => s.unlocked);
  const lock = useAuthStore((s) => s.lock);
  const navigate = useNavigate();
  const pendingCount = useSyncStatus((s) => s.pendingCount);

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-1 rounded-3xl bg-slate-900/85 p-1.5 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl sm:static sm:order-1 sm:inset-auto sm:w-24 sm:flex-col sm:gap-2 sm:rounded-none sm:bg-slate-950/60 sm:p-3 sm:pt-6 sm:shadow-none sm:ring-0 sm:ring-white/5 sm:[border-inline-end:1px_solid_rgba(255,255,255,0.08)]"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="hidden shrink-0 items-center justify-center pb-2 sm:flex">
        <ClubLogo className="h-11 w-11 object-contain" />
      </div>

      {pendingCount > 0 && (
        <div className="hidden shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-amber-500/10 px-2 py-2 text-center ring-1 ring-amber-500/30 sm:flex">
          <span className="text-[0.65rem] font-bold text-amber-400">Sin conexión</span>
          <span className="text-[0.6rem] text-amber-300">{pendingCount} sin subir</span>
        </div>
      )}

      <div className="flex flex-1 items-center gap-1 sm:flex-col sm:gap-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2.5 text-xs font-bold transition-colors touch-manipulation sm:w-full sm:flex-none sm:py-4 sm:text-sm',
                isActive ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 active:bg-white/5',
              ].join(' ')
            }
          >
            <tab.icon />
            <span>{tab.label}</span>
          </NavLink>
        ))}

        {pendingCount > 0 && (
          <span className="flex shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[0.6rem] font-black text-slate-900 sm:hidden">
            {pendingCount}
          </span>
        )}

        {unlocked ? (
          <button
            type="button"
            onClick={() => lock()}
            className="flex flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-2.5 text-xs font-bold text-emerald-400 touch-manipulation active:bg-white/5 sm:mt-auto sm:w-full sm:flex-none sm:py-4"
          >
            <UnlockIcon />
            <span>Bloquear</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/desbloquear')}
            className="flex flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-2.5 text-xs font-bold text-slate-400 touch-manipulation active:bg-white/5 sm:mt-auto sm:w-full sm:flex-none sm:py-4"
          >
            <LockIcon />
            <span>Anotar</span>
          </button>
        )}
      </div>
    </nav>
  );
}
