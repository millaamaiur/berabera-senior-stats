interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A pill-shaped option switcher — a mobile-friendly stand-in for a native <select>. */
export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full bg-white/5 p-1 ring-1 ring-white/10">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors touch-manipulation',
            value === opt.value ? 'bg-amber-500 text-slate-900' : 'text-slate-400',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
