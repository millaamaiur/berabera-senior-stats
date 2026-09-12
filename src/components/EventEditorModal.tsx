import { useState } from 'react';
import type { MatchEvent, Player, Zone } from '../domain/types';
import type { TimelineRow } from '../stats/timeline';
import { EVENT_LABELS } from '../utils/eventLabels';
import { formatClock } from '../utils/time';
import { ShotGrid3x3 } from './ShotGrid3x3';
import { useConfirmDialog } from './ConfirmDialog';

export type EventEditorTarget =
  | { kind: 'single'; event: MatchEvent; player: Player | undefined }
  | { kind: 'substitution'; outEvent: MatchEvent; inEvent: MatchEvent; playerOut: Player; playerIn: Player };

/** Turns a timeline row (as rendered) into the shape EventEditorModal needs. */
export function targetFromTimelineRow(row: TimelineRow, players: Player[]): EventEditorTarget {
  if (row.kind === 'substitution') {
    return {
      kind: 'substitution',
      outEvent: row.outEvent,
      inEvent: row.inEvent,
      playerOut: row.playerOut,
      playerIn: row.playerIn,
    };
  }
  return { kind: 'single', event: row.event, player: players.find((p) => p.id === row.event.playerId) };
}

interface EventEditorModalProps {
  target: EventEditorTarget;
  onUpdateEvent: (event: MatchEvent) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onClose: () => void;
}

const RESULT_LABELS: Record<string, string> = { goal: 'Gol', miss: 'Fallo', save: 'Parada' };

/** Edit the result/zone of a shot, or delete any single event / substitution pair. */
export function EventEditorModal({ target, onUpdateEvent, onDeleteEvent, onClose }: EventEditorModalProps) {
  const { ask, dialog } = useConfirmDialog();
  const initialEvent = target.kind === 'single' ? target.event : null;
  const isShot = initialEvent?.eventType === 'shot' || initialEvent?.eventType === 'gk_shot';
  const [draftResult, setDraftResult] = useState<string | null>(
    initialEvent && (initialEvent.eventType === 'shot' || initialEvent.eventType === 'gk_shot')
      ? initialEvent.eventData.result
      : null
  );

  async function handleDeleteSingle(id: string, label: string) {
    if (await ask({ title: `¿Eliminar "${label}"?`, danger: true, confirmLabel: 'Eliminar' })) {
      await onDeleteEvent(id);
      onClose();
    }
  }

  async function handleDeletePair() {
    if (target.kind !== 'substitution') return;
    if (await ask({ title: '¿Eliminar este cambio?', message: 'Se borrarán la salida y la entrada.', danger: true, confirmLabel: 'Eliminar' })) {
      await onDeleteEvent(target.outEvent.id);
      await onDeleteEvent(target.inEvent.id);
      onClose();
    }
  }

  async function handleZoneClick(zone: Zone) {
    if (target.kind !== 'single' || !draftResult) return;
    const event = target.event;
    if (event.eventType === 'shot') {
      await onUpdateEvent({ ...event, eventData: { ...event.eventData, result: draftResult as 'goal' | 'miss', zone } });
      onClose();
    } else if (event.eventType === 'gk_shot') {
      await onUpdateEvent({ ...event, eventData: { ...event.eventData, result: draftResult as 'save' | 'goal', zone } });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Editar evento</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400" aria-label="Cerrar">
            ×
          </button>
        </div>

        {target.kind === 'substitution' ? (
          <>
            <div className="rounded-lg bg-slate-800 p-3 text-sm text-white">
              <p className="font-mono text-amber-400">{formatClock(target.outEvent.timestamp)}</p>
              <p className="mt-1 flex items-center gap-1.5">
                <span className="font-bold text-rose-400">↓</span> {target.playerOut.name}
                <span className="font-bold text-emerald-400">↑</span> {target.playerIn.name}
              </p>
            </div>
            <button type="button" onClick={handleDeletePair} className="rounded-lg bg-rose-600 px-4 py-3 font-bold text-white">
              Eliminar cambio
            </button>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-slate-800 p-3 text-sm text-white">
              <p className="font-mono text-amber-400">{formatClock(target.event.timestamp)}</p>
              <p className="mt-1 font-semibold">{target.player?.name ?? '—'}</p>
              <p className="text-slate-400">{EVENT_LABELS[target.event.eventType]}</p>
            </div>

            {isShot && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-slate-300">Resultado</p>
                <div className="flex gap-2">
                  {(target.event.eventType === 'shot' ? ['goal', 'miss'] : ['save', 'goal']).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDraftResult(opt)}
                      className={[
                        'rounded-lg border-2 px-4 py-2 font-bold',
                        draftResult === opt ? 'border-amber-400 bg-amber-500 text-slate-900' : 'border-slate-600 bg-slate-800 text-white',
                      ].join(' ')}
                    >
                      {RESULT_LABELS[opt]}
                    </button>
                  ))}
                </div>
                <p className="text-sm font-semibold text-slate-300">Zona (toca para guardar)</p>
                <ShotGrid3x3 onSelectZone={handleZoneClick} />
              </div>
            )}

            <button
              type="button"
              onClick={() => handleDeleteSingle(target.event.id, EVENT_LABELS[target.event.eventType])}
              className="rounded-lg bg-rose-600 px-4 py-3 font-bold text-white"
            >
              Eliminar evento
            </button>
          </>
        )}
      </div>
      {dialog}
    </div>
  );
}
