import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ClubLogo } from './ClubLogo';
import { useAuthStore } from '../stores/useAuthStore';

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

  return (
    <nav className="flex shrink-0 border-t-2 border-slate-700 bg-slate-900 sm:order-first sm:w-28 sm:flex-col sm:border-r-2 sm:border-t-0">
      <div className="hidden shrink-0 items-center justify-center py-3 sm:flex">
        <ClubLogo className="h-12 w-12 object-contain" />
      </div>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-base font-semibold touch-manipulation sm:py-6',
              isActive ? 'bg-slate-700 text-amber-400' : 'text-slate-300',
            ].join(' ')
          }
        >
          <tab.icon />
          <span>{tab.label}</span>
        </NavLink>
      ))}
      {unlocked ? (
        <button
          type="button"
          onClick={() => lock()}
          className="flex shrink-0 flex-col items-center justify-center gap-1 border-t-2 border-slate-700 py-3 text-xs font-semibold text-emerald-400 sm:border-t-0 sm:border-t-2"
        >
          <UnlockIcon />
          <span>Bloquear</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/desbloquear')}
          className="flex shrink-0 flex-col items-center justify-center gap-1 border-t-2 border-slate-700 py-3 text-xs font-semibold text-slate-300 sm:border-t-0 sm:border-t-2"
        >
          <LockIcon />
          <span>Anotar</span>
        </button>
      )}
    </nav>
  );
}
