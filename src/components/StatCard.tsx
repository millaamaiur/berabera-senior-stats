interface StatCardProps {
  label: string;
  value: string | number;
  size?: 'sm' | 'md';
}

/** A single rounded stat tile — used for team, player and goalkeeper summary grids. */
export function StatCard({ label, value, size = 'md' }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/5 px-2 py-3 text-center ring-1 ring-white/10">
      <p className={size === 'sm' ? 'text-lg font-extrabold text-white' : 'text-2xl font-extrabold text-white'}>{value}</p>
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
