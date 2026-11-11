import { useState } from 'react';
import type { Player, SimpleFieldEventType, Zone } from '../domain/types';
import { useLiveMatchStore } from '../stores/useLiveMatchStore';
import { ShotGrid3x3 } from './ShotGrid3x3';

interface ActionPanelProps {
  player: Player;
}

const POSSESSION_ACTIONS: { type: SimpleFieldEventType; label: string }[] = [
  { type: 'turnover', label: 'Pérdida' },
  { type: 'recovery', label: 'Recuperación' },
];

const CARD_ACTIONS: { type: SimpleFieldEventType; label: string }[] = [
  { type: 'card_yellow', label: 'Amarilla' },
  { type: 'card_red', label: 'Roja' },
  { type: 'card_blue', label: 'Azul' },
  { type: 'exclusion_2min', label: '2 minutos' },
];

/** `counter`: a counterattack — ours for 'field', the rival's (shot at our keeper) for 'gk'. */
type ShotFlow = { kind: 'field' | 'gk'; context: 'open_play' | 'penalty'; counter?: boolean };
/** 'outside' is our own "Fuera": stored as a miss with no zone, but picked as its own option. */
type ShotResult = 'goal' | 'miss' | 'save' | 'outside' | 'turnover';
type Step = { kind: 'shot'; flow: ShotFlow; result?: ShotResult } | { kind: 'card' } | null;

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

  async function chooseResult(result: ShotResult) {
    if (!step || step.kind !== 'shot') return;
    const { flow } = step;
    // A "Fuera" never reaches the goal frame, so there's no zone to pick —
    // unlike "Fallo" (on target, saved). Record it immediately instead.
    if (flow.kind === 'gk' && result === 'miss') {
      await recordGkShot(player.id, { result: 'miss', context: flow.context, ...counterFlag(flow) });
      finishAndReset();
      return;
    }
    if (flow.kind === 'field' && result === 'outside') {
      await recordShot(player.id, { result: 'miss', context: flow.context, ...counterFlag(flow) });
      finishAndReset();
      return;
    }
    // A counter that ended with the ball lost has no shot at all — it's just a turnover.
    if (result === 'turnover') {
      await recordSimpleEvent(player.id, 'turnover', { counter: true });
      finishAndReset();
      return;
    }
    setStep({ ...step, result });
  }

  async function chooseZone(zone: Zone) {
    if (!step || step.kind !== 'shot' || !step.result) return;
    const { flow } = step;
    if (flow.kind === 'field') {
      await recordShot(player.id, { result: step.result as 'goal' | 'miss', zone, context: flow.context, ...counterFlag(flow) });
    } else {
      await recordGkShot(player.id, { result: step.result as 'save' | 'goal', zone, context: flow.context, ...counterFlag(flow) });
    }
    finishAndReset();
  }

  if (step?.kind === 'shot' && !step.result) {
    const { flow } = step;
    const options: ShotResult[] =
      flow.kind === 'gk'
        ? ['save', 'goal', 'miss']
        : flow.counter
          ? ['goal', 'miss', 'outside', 'turnover']
          : ['goal', 'miss', 'outside'];
    const labels: Record<string, string> =
      flow.kind === 'gk'
        ? { save: 'Parada', goal: 'Gol', miss: 'Fuera' }
        : { goal: 'Gol', miss: 'Fallo', outside: 'Fuera', turnover: 'Pérdida' };
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-white">{flow.counter ? '¿Cómo acaba el contraataque?' : '¿Resultado?'}</p>
        <div className="flex flex-wrap justify-center gap-4">
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
        <ShotGrid3x3 onSelectZone={chooseZone} />
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
          <ActionButton
            label="Contraataque"
            onClick={() => startShot({ kind: 'gk', context: 'open_play', counter: true })}
          />
          <ActionButton label="Penalti" onClick={() => startShot({ kind: 'gk', context: 'penalty' })} />
          {/* The keeper's own goal is a regular `shot` (it counts for us), so skip straight to its zone. */}
          <ActionButton
            label="Marca gol"
            onClick={() => setStep({ kind: 'shot', flow: { kind: 'field', context: 'open_play' }, result: 'goal' })}
          />
          {POSSESSION_ACTIONS.map((a) => (
            <ActionButton key={a.type} label={a.label} onClick={() => handleSimple(a.type)} />
          ))}
        </>
      ) : (
        <>
          <ActionButton label="Lanzamiento" onClick={() => startShot({ kind: 'field', context: 'open_play' })} />
          <ActionButton
            label="Contraataque"
            onClick={() => startShot({ kind: 'field', context: 'open_play', counter: true })}
          />
          <ActionButton label="Penalti" onClick={() => startShot({ kind: 'field', context: 'penalty' })} />
          {POSSESSION_ACTIONS.map((a) => (
            <ActionButton key={a.type} label={a.label} onClick={() => handleSimple(a.type)} />
          ))}
          <ActionButton label="Amonestación" onClick={() => setStep({ kind: 'card' })} />
        </>
      )}
    </div>
  );
}

/** Only tag counterattack events, so ordinary ones keep the exact shape they've always had. */
function counterFlag(flow: ShotFlow): { counter?: true } {
  return flow.counter ? { counter: true } : {};
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
