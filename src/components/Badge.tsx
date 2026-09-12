import type { ReactNode } from 'react';

type BadgeColor = 'amber' | 'emerald' | 'rose' | 'slate' | 'sky';

interface BadgeProps {
  color: BadgeColor;
  children: ReactNode;
}

const COLOR_CLASSES: Record<BadgeColor, string> = {
  amber: 'bg-amber-500/15 text-amber-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  rose: 'bg-rose-500/15 text-rose-400',
  slate: 'bg-white/10 text-slate-300',
  sky: 'bg-sky-500/15 text-sky-300',
};

/** A small tonal pill for statuses (result, live, active/inactive...). */
export function Badge({ color, children }: BadgeProps) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}
