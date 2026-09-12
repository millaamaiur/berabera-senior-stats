import type { MatchEvent, Player } from '../domain/types';
import { buildTimeline, type TimelineRow } from '../stats/timeline';
import { describeEventDetail, EVENT_LABELS } from '../utils/eventLabels';
import { formatClock } from '../utils/time';

interface CompactTimelineProps {
  events: MatchEvent[];
  players: Player[];
  onRowClick?: (row: TimelineRow) => void;
}

/** A narrow timeline for the finished-match detail screen — same data as the full timeline, in less width. */
export function CompactTimeline({ events, players, onRowClick }: CompactTimelineProps) {
  const rows = buildTimeline(events, players);
  const rowClass =
    'flex flex-col gap-0.5 rounded-xl bg-white/5 px-2 py-1.5 text-left ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.98]';

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const clickable = Boolean(onRowClick);
        if (row.kind === 'substitution') {
          const content = (
            <>
              <span className="font-mono text-[0.6rem] text-slate-500">{formatClock(row.timestamp)}</span>
              <span className="truncate text-xs font-semibold text-white">
                <span className="font-bold text-rose-400">↓</span> {row.playerOut.name}
              </span>
              <span className="truncate text-xs font-semibold text-white">
                <span className="font-bold text-emerald-400">↑</span> {row.playerIn.name}
              </span>
            </>
          );
          return clickable ? (
            <button key={row.id} type="button" onClick={() => onRowClick?.(row)} className={rowClass}>
              {content}
            </button>
          ) : (
            <div key={row.id} className={rowClass}>
              {content}
            </div>
          );
        }

        const player = players.find((p) => p.id === row.event.playerId);
        const detail = describeEventDetail(row.event);
        const content = (
          <>
            <span className="font-mono text-[0.6rem] text-slate-500">{formatClock(row.event.timestamp)}</span>
            <span className="truncate text-xs font-semibold text-white">{player?.name ?? '—'}</span>
            <span className="truncate text-[0.7rem] text-slate-400">
              {EVENT_LABELS[row.event.eventType]}
              {detail ? ` · ${detail}` : ''}
            </span>
          </>
        );
        return clickable ? (
          <button key={row.id} type="button" onClick={() => onRowClick?.(row)} className={rowClass}>
            {content}
          </button>
        ) : (
          <div key={row.id} className={rowClass}>
            {content}
          </div>
        );
      })}
      {rows.length === 0 && <p className="p-2 text-sm text-slate-400">Sin eventos registrados.</p>}
    </div>
  );
}
