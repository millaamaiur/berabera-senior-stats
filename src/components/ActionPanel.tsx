import { useState } from 'react';
import type { Player, SimpleFieldEventType, Zone } from '../domain/types';
import { useLiveMatchStore } from '../stores/useLiveMatchStore';
import { ShotGrid3x3 } from './ShotGrid3x3';

interface ActionPanelProps {
  player: Player;
}

const FIELD_ACTIONS: { type: SimpleFieldEventType; label: string }[] = [
  { type: 'turnover', label: 'Pérdida' },
  { type: 'recovery', label: 'Recuperación' },
  { type: 'steps', label: 'Pasos' },
  { type: 'assist', label: 'Asistencia' },
];

const CARD_ACTIONS: { type: SimpleFieldEventType; label: string }[] = [
  { type: 'card_yellow', label: 'Amarilla' },
  { type: 'card_red', label: 'Roja' },
  { type: 'card_blue', label: 'Azul' },
  { type: 'exclusion_2min', label: '2 minutos' },
];

type ShotFlow = { kind: 'field'; context: 'open_play' | 'penalty' } | { kind: 'gk'; context: 'open_play' | 'penalty' };
type Step =
  | { kind: 'shot'; flow: ShotFlow; result?: 'goal' | 'miss' | 'save' }
  | { kind: 'card' }
  | null;

export function ActionPanel({ player }: ActionPanelProps) {
  const recordSimpleEvent = useLiveMatchStore((s) => s.recordSimpleEvent);
  const recordShot = useLiveMatchStore((s) => s.recordShot);
  const recordGkShot = useLiveMatchStore((s) => s.recordGkShot);
  const selectPlayer = useLiveMatchStore((s) => s.selectPlayer);
  const [step, setStep] = useState<Step>(null);

  const isGoalkeeper = player.position === 'goalkeeper';

  function finishAndReset() {
    setStep(null);
    selectPlayer(null);
  }

  async function handleSimple(type: SimpleFieldEventType) {
    await recordSimpleEvent(player.id, type);
    finishAndReset();
  }

  function startShot(flow: ShotFlow) {
    setStep({ kind: 'shot', flow });
  }

  function chooseResult(result: 'goal' | 'miss' | 'save') {
    if (!step || step.kind !== 'shot') return;
    setStep({ ...step, result });
  }

  async function chooseZone(zone: Zone | null) {
    if (!step || step.kind !== 'shot' || !step.result) return;
    if (step.flow.kind === 'field') {
      await recordShot(player.id, { result: step.result as 'goal' | 'miss', zone: zone ?? undefined, context: step.flow.context });
    } else if (zone !== null) {
      await recordGkShot(player.id, { result: step.result as 'save' | 'goal', zone, context: step.flow.context });
    }
    finishAndReset();
  }

  if (step?.kind === 'shot' && !step.result) {
    const options = step.flow.kind === 'field' ? (['goal', 'miss'] as const) : (['save', 'goal'] as const);
    const labels: Record<string, string> = { goal: 'Gol', miss: 'Fallo', save: 'Parada' };
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-white">¿Resultado?</p>
        <div className="flex gap-4">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => chooseResult(opt)}
              className="h-20 min-w-32 rounded-2xl bg-white/8 text-xl font-bold text-white shadow-md ring-1 ring-white/10 transition-transform active:scale-95 active:bg-white/12"
            >
              {labels[opt]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setStep(null)} className="text-sm text-slate-400 underline">
          Cancelar
        </button>
      </div>
    );
  }

  if (step?.kind === 'shot' && step.result) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-lg font-semibold text-white">¿Zona de portería?</p>
        <ShotGrid3x3 onSelectZone={chooseZone} allowOutside={step.flow.kind === 'field'} />
        <button type="button" onClick={() => setStep(null)} className="text-sm text-slate-400 underline">
          Cancelar
        </button>
      </div>
    );
  }

  if (step?.kind === 'card') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-white">¿Qué amonestación?</p>
        <div className="grid grid-cols-2 gap-3">
          {CARD_ACTIONS.map((a) => (
            <ActionButton key={a.type} label={a.label} onClick={() => handleSimple(a.type)} />
          ))}
        </div>
        <button type="button" onClick={() => setStep(null)} className="text-sm text-slate-400 underline">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {isGoalkeeper ? (
        <>
          <ActionButton label="Lanzamiento" onClick={() => startShot({ kind: 'gk', context: 'open_play' })} />
          <ActionButton label="Penalti" onClick={() => startShot({ kind: 'gk', context: 'penalty' })} />
        </>
      ) : (
        <>
          <ActionButton label="Lanzamiento" onClick={() => startShot({ kind: 'field', context: 'open_play' })} />
          <ActionButton label="Penalti" onClick={() => startShot({ kind: 'field', context: 'penalty' })} />
          {FIELD_ACTIONS.map((a) => (
            <ActionButton key={a.type} label={a.label} onClick={() => handleSimple(a.type)} />
          ))}
          <ActionButton label="Amonestación" onClick={() => setStep({ kind: 'card' })} />
        </>
      )}
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-20 rounded-2xl bg-white/8 text-lg font-bold text-white shadow-md ring-1 ring-white/10 transition-transform touch-manipulation active:scale-95 active:bg-white/12"
    >
      {label}
    </button>
  );
}
