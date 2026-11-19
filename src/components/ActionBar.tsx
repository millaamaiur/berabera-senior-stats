import type { Player } from '../domain/types';
import type { StagedAction } from './ActionPanel';

export type ActionKind = StagedAction | 'turnover' | 'recovery';

const ACTIONS: { kind: ActionKind; label: string }[] = [
  { kind: 'shot', label: 'Lanzamiento' },
  { kind: 'counter', label: 'Contraataque' },
  { kind: 'penalty', label: 'Penalti' },
  { kind: 'turnover', label: 'Pérdida' },
  { kind: 'recovery', label: 'Recuperación' },
  { kind: 'card', label: 'Amonestación' },
];

/** Only for our goalkeeper. It goes last, in a slot of its own, so no other button ever moves. */
const KEEPER_GOAL = { kind: 'keeper_goal', label: 'Marca gol' } as const;

interface ActionBarProps {
  /** The player picked on the court; every action stays greyed out until there is one. */
  player: Player | null;
  activeAction: StagedAction | null;
  subsMode: boolean;
  onAction: (kind: ActionKind) => void;
  onToggleSubs: () => void;
}

/** The strip above the court: what the picked player did, plus the way into substitutions. */
export function ActionBar({ player, activeAction, subsMode, onAction, onToggleSubs }: ActionBarProps) {
  const actions = player?.position === 'goalkeeper' ? [...ACTIONS, KEEPER_GOAL] : ACTIONS;
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
      <div className="grid flex-1 grid-cols-4 gap-2 md:grid-cols-7">
        {actions.map(({ kind, label }) => {
          const unavailable = !player || subsMode;
          const active = kind === activeAction;
          return (
            <button
              key={kind}
              type="button"
              disabled={unavailable}
              onClick={() => onAction(kind)}
              className={[
                'h-14 truncate rounded-2xl px-1 text-base font-bold ring-1 transition-transform touch-manipulation sm:h-16 xl:text-lg',
                unavailable
                  ? 'cursor-not-allowed bg-white/5 text-slate-600 ring-white/5'
                  : active
                    ? 'bg-amber-500 text-slate-900 ring-amber-400'
                    : 'bg-white/8 text-white shadow-md ring-white/10 active:scale-95 active:bg-white/12',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onToggleSubs}
        aria-pressed={subsMode}
        className={[
          'h-14 shrink-0 rounded-full px-4 font-bold shadow-lg transition-transform touch-manipulation active:scale-95 sm:h-16',
          subsMode ? 'bg-emerald-500 text-slate-900 shadow-emerald-500/20' : 'bg-amber-500 text-slate-900 shadow-amber-500/20',
        ].join(' ')}
      >
        {subsMode ? 'Terminar cambios' : 'Hacer cambios'}
      </button>
    </div>
  );
}
