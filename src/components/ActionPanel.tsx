import { useState } from 'react';
import type { Player, SimpleFieldEventType, Zone } from '../domain/types';
import { useLiveMatchStore } from '../stores/useLiveMatchStore';
import { ShotGrid3x3 } from './ShotGrid3x3';

interface ActionPanelProps {
  player: Player;
}

const FIELD_ACTIONS: { type: SimpleFieldEventType; label: string }[] = [
  { type: 'turnover', label: 'Pérdida' },
  { type: 'steps', label: 'Pasos' },
  { type: 'assist', label: 'Asistencia' },
  { type: 'card_yellow', label: 'Amarilla' },
  { type: 'card_red', label: 'Roja' },
  { type: 'card_blue', label: 'Azul' },
  { type: 'exclusion_2min', label: '2 minutos' },
];

type ShotFlow = { kind: 'field' } | { kind: 'gk'; context: 'open_play' | 'penalty' };
type Step = { flow: ShotFlow; result?: 'goal' | 'miss' | 'save' } | null;

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
    setStep({ flow });
  }

  function chooseResult(result: 'goal' | 'miss' | 'save') {
    if (!step) return;
    setStep({ ...step, result });
  }

  async function chooseZone(zone: Zone) {
    if (!step || !step.result) return;
    if (step.flow.kind === 'field') {
      await recordShot(player.id, { result: step.result as 'goal' | 'miss', zone });
    } else {
      await recordGkShot(player.id, { result: step.result as 'save' | 'goal', zone, context: step.flow.context });
    }
    finishAndReset();
  }

  if (step && !step.result) {
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
              className="h-20 min-w-32 rounded-xl border-4 border-slate-500 bg-slate-700 text-xl font-bold text-white active:bg-slate-600"
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

  if (step && step.result) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-lg font-semibold text-white">¿Zona de portería?</p>
        <ShotGrid3x3 onSelectZone={chooseZone} />
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
          <ActionButton label="Lanzamiento" onClick={() => startShot({ kind: 'field' })} />
          {FIELD_ACTIONS.map((a) => (
            <ActionButton key={a.type} label={a.label} onClick={() => handleSimple(a.type)} />
          ))}
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
      className="h-20 rounded-xl border-4 border-slate-500 bg-slate-700 text-lg font-bold text-white shadow active:bg-slate-600 touch-manipulation"
    >
      {label}
    </button>
  );
}
