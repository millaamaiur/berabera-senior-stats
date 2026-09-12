import type { MatchEvent, Player } from '../domain/types';
import { buildTimeline, type TimelineRow } from '../stats/timeline';
import { describeEventDetail, EVENT_LABELS } from '../utils/eventLabels';
import { formatClock } from '../utils/time';

interface LiveTimelineProps {
  events: MatchEvent[];
  players: Player[];
  onRowClick?: (row: TimelineRow) => void;
}

export function LiveTimeline({ events, players, onRowClick }: LiveTimelineProps) {
  const rows = buildTimeline(events, players).reverse();

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 shrink-0 text-sm font-semibold text-slate-400">Cronología</p>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {rows.map((row) => {
          const clickable = Boolean(onRowClick);
          if (row.kind === 'substitution') {
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onRowClick?.(row)}
                disabled={!clickable}
                className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-left text-sm text-white ring-1 ring-white/5 transition-transform touch-manipulation active:scale-[0.99] disabled:cursor-default disabled:active:scale-100"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-amber-400">{formatClock(row.timestamp)}</span>
                <span className="flex flex-1 items-center gap-1.5 truncate">
                  <span className="font-bold text-rose-400">↓</span>
                  <span className="truncate">{row.playerOut.name}</span>
                  <span className="font-bold text-emerald-400">↑</span>
                  <span className="truncate">{row.playerIn.name}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">Cambio</span>
              </button>
            );
          }
          const player = players.find((p) => p.id === row.event.playerId);
          const detail = describeEventDetail(row.event);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onRowClick?.(row)}
              disabled={!clickable}
              className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-2 py-1.5 text-left text-sm text-white disabled:cursor-default"
            >
              <span className="w-12 shrink-0 font-mono text-xs text-amber-400">{formatClock(row.event.timestamp)}</span>
              <span className="flex-1 truncate font-semibold">{player?.name ?? '—'}</span>
              <span className="shrink-0 text-xs text-slate-300">{EVENT_LABELS[row.event.eventType]}</span>
              {detail && <span className="shrink-0 text-xs text-slate-500">{detail}</span>}
            </button>
          );
        })}
        {rows.length === 0 && (
          <p className="flex flex-1 items-center justify-center text-sm text-slate-500">Los eventos aparecerán aquí</p>
        )}
      </div>
    </div>
  );
}
