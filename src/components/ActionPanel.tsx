import { useRef, useState } from 'react';
import type { Player, SuspensionEventType, Zone } from '../domain/types';
import { useLiveMatchStore } from '../stores/useLiveMatchStore';
import { ShotGrid3x3 } from './ShotGrid3x3';

/**
 * Actions that need a second screen (result and zone, which card, or — for
 * our goalkeeper scoring — just the zone) before they're recorded.
 */
export type StagedAction = 'shot' | 'counter' | 'penalty' | 'card' | 'keeper_goal';

const ACTION_LABELS: Record<StagedAction, string> = {
  shot: 'Lanzamiento',
  counter: 'Contraataque',
  penalty: 'Penalti',
  card: 'Amonestación',
  keeper_goal: 'Marca gol',
};

const CARD_ACTIONS: { type: 'card_yellow' | SuspensionEventType; label: string }[] = [
  { type: 'card_yellow', label: 'Amarilla' },
  { type: 'card_red', label: 'Roja' },
  { type: 'card_blue', label: 'Azul' },
  { type: 'exclusion_2min', label: '2 minutos' },
];

/** 'outside' is our own "Fuera": stored as a miss with no zone, but picked as its own option. */
type ShotResult = 'goal' | 'miss' | 'save' | 'outside' | 'turnover';

interface ActionPanelProps {
  player: Player;
  action: StagedAction;
  /** Called once the action is recorded. */
  onDone: () => void;
  onCancel: () => void;
  /** For a keeper's 2 minutos / roja / azul: who can take over the goal… */
  benchGoalkeepers?: Player[];
  /** …and which field player can make room for them. */
  courtFieldPlayers?: Player[];
}

/** A keeper's suspension: first which keeper comes in, then who makes room. */
type KeeperCover = { type: SuspensionEventType; keeperIn?: Player };

/**
 * Replaces the court once a player and an action are picked: the result and
 * the goal zone on one screen for a shot, or which card for an amonestación.
 * Tapping the goalkeeper means the rival's shot at them.
 */
export function ActionPanel({
  player,
  action,
  onDone,
  onCancel,
  benchGoalkeepers = [],
  courtFieldPlayers = [],
}: ActionPanelProps) {
  const recordSimpleEvent = useLiveMatchStore((s) => s.recordSimpleEvent);
  const recordShot = useLiveMatchStore((s) => s.recordShot);
  const recordGkShot = useLiveMatchStore((s) => s.recordGkShot);
  const recordSuspension = useLiveMatchStore((s) => s.recordSuspension);
  const [result, setResult] = useState<ShotResult | null>(null);
  const [keeperCover, setKeeperCover] = useState<KeeperCover | null>(null);
  // A second tap before this screen closes must not record it twice.
  const saving = useRef(false);

  const isGoalkeeper = player.position === 'goalkeeper';
  const context = action === 'penalty' ? 'penalty' : 'open_play';
  const counter = action === 'counter';
  // Only tag counterattack events, so ordinary ones keep the exact shape they've always had.
  const counterFlag: { counter?: true } = counter ? { counter: true } : {};

  /**
   * Back to the court straight away: the store puts the event on screen (score,
   * timeline) before it's uploaded, so a slow connection never holds this up.
   */
  function save(record: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    void record();
    onDone();
  }

  function chooseResult(next: ShotResult) {
    // A "Fuera" never reaches the goal frame, so there's no zone to pick —
    // unlike "Fallo" (on target, saved). Record it straight away.
    if (isGoalkeeper && next === 'miss') {
      void save(() => recordGkShot(player.id, { result: 'miss', context, ...counterFlag }));
      return;
    }
    if (next === 'outside') {
      void save(() => recordShot(player.id, { result: 'miss', context, ...counterFlag }));
      return;
    }
    // A counter that ended with the ball lost has no shot at all — it's just a turnover.
    if (next === 'turnover') {
      void save(() => recordSimpleEvent(player.id, 'turnover', { counter: true }));
      return;
    }
    setResult(next);
  }

  function chooseZone(zone: Zone) {
    // Our keeper scoring is an ordinary open-play goal of ours, exactly as "Marca gol" always recorded it.
    if (action === 'keeper_goal') {
      void save(() => recordShot(player.id, { result: 'goal', zone, context: 'open_play' }));
      return;
    }
    if (!result) return;
    if (isGoalkeeper) {
      void save(() => recordGkShot(player.id, { result: result as 'save' | 'goal', zone, context, ...counterFlag }));
    } else {
      void save(() => recordShot(player.id, { result: result as 'goal' | 'miss', zone, context, ...counterFlag }));
    }
  }

  const header = (
    <div className="flex shrink-0 items-start justify-between gap-3">
      <p className="text-lg font-bold text-white">
        <span className="text-slate-400">{player.number}</span> {player.name} · {ACTION_LABELS[action]}
        {isGoalkeeper && action !== 'card' && action !== 'keeper_goal' ? ' del rival' : ''}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-full bg-white/8 px-4 py-2.5 font-semibold text-white ring-1 ring-white/10 touch-manipulation active:scale-95"
      >
        Cancelar
      </button>
    </div>
  );

  if (action === 'card' && keeperCover && !keeperCover.keeperIn) {
    return (
      <div className="flex h-full flex-col gap-4">
        {header}
        <p className="font-semibold text-slate-300">Sale de la portería. ¿Qué portero entra?</p>
        <div className="grid grid-cols-2 gap-3">
          {benchGoalkeepers.map((gk) => (
            <PlayerButton key={gk.id} player={gk} onClick={() => setKeeperCover({ ...keeperCover, keeperIn: gk })} />
          ))}
        </div>
        {benchGoalkeepers.length === 0 && <p className="text-sm text-slate-400">No hay ningún portero en el banquillo.</p>}
        <button
          type="button"
          onClick={() => save(() => recordSuspension(player.id, keeperCover.type))}
          className="self-start rounded-full px-4 py-2.5 font-semibold text-slate-300 ring-1 ring-white/15 touch-manipulation active:scale-95"
        >
          Sin cambiar de portero
        </button>
      </div>
    );
  }

  if (action === 'card' && keeperCover?.keeperIn) {
    const keeperIn = keeperCover.keeperIn;
    return (
      <div className="flex h-full flex-col gap-4">
        {header}
        <p className="font-semibold text-slate-300">
          Entra {keeperIn.name}. ¿Qué jugador de campo le deja sitio?
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {courtFieldPlayers.map((fp) => (
            <PlayerButton
              key={fp.id}
              player={fp}
              onClick={() =>
                save(() => recordSuspension(player.id, keeperCover.type, { keeperInId: keeperIn.id, fieldOutId: fp.id }))
              }
            />
          ))}
        </div>
        <p className="text-sm text-slate-400">Su sitio cuenta atrás los 2 minutos y luego vuelve él.</p>
      </div>
    );
  }

  if (action === 'card') {
    return (
      <div className="flex h-full flex-col gap-4">
        {header}
        <p className="font-semibold text-slate-300">¿Qué amonestación?</p>
        <div className="grid grid-cols-2 gap-3">
          {CARD_ACTIONS.map((card) => (
            <BigButton
              key={card.type}
              label={card.label}
              onClick={() => {
                const type = card.type;
                if (type === 'card_yellow') save(() => recordSimpleEvent(player.id, type));
                // The keeper leaves the goal: ask who takes it over before recording.
                else if (isGoalkeeper) setKeeperCover({ type });
                else save(() => recordSuspension(player.id, type));
              }}
            />
          ))}
        </div>
        <p className="text-sm text-slate-400">2 minutos, roja y azul le sacan del campo y su sitio cuenta atrás.</p>
      </div>
    );
  }

  if (action === 'keeper_goal') {
    return (
      <div className="flex h-full flex-col gap-3 [container-type:size]">
        {header}
        <p className="shrink-0 font-semibold text-slate-300">¿Zona de portería?</p>
        <div className="mx-auto" style={{ width: 'min(24rem, 100cqw, max(9rem, 100cqh - 6rem))' }}>
          <ShotGrid3x3 onSelectZone={chooseZone} />
        </div>
      </div>
    );
  }

  const options: ShotResult[] = isGoalkeeper
    ? ['save', 'goal', 'miss']
    : counter
      ? ['goal', 'miss', 'outside', 'turnover']
      : ['goal', 'miss', 'outside'];
  const labels: Partial<Record<ShotResult, string>> = isGoalkeeper
    ? { save: 'Parada', goal: 'Gol', miss: 'Fuera' }
    : { goal: 'Gol', miss: 'Fallo', outside: 'Fuera', turnover: 'Pérdida' };

  return (
    <div className="flex h-full flex-col gap-3 [container-type:size]">
      {header}
      <p className="shrink-0 font-semibold text-slate-300">{counter ? '¿Cómo acaba el contraataque?' : '¿Resultado?'}</p>
      <div className={['grid shrink-0 gap-2', options.length === 4 ? 'grid-cols-4' : 'grid-cols-3'].join(' ')}>
        {options.map((opt) => (
          <BigButton key={opt} label={labels[opt] ?? opt} active={result === opt} onClick={() => chooseResult(opt)} />
        ))}
      </div>
      <p className={['shrink-0 font-semibold', result ? 'text-slate-300' : 'text-slate-500'].join(' ')}>
        {result ? '¿Zona de portería?' : 'Elige el resultado y luego la zona'}
      </p>
      {/* Sized to whatever height is left, so the whole screen fits without scrolling. */}
      <div className="mx-auto" style={{ width: 'min(24rem, 100cqw, max(9rem, 100cqh - 14rem))' }}>
        <ShotGrid3x3 onSelectZone={chooseZone} disabled={!result} />
      </div>
    </div>
  );
}

function PlayerButton({ player, onClick }: { player: Player; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex h-16 items-center gap-2 rounded-2xl px-3 text-left font-bold ring-1 transition-transform touch-manipulation active:scale-95',
        player.position === 'goalkeeper' ? 'bg-sky-500/10 text-sky-300 ring-sky-500/40' : 'bg-white/8 text-white ring-white/10',
      ].join(' ')}
    >
      <span className="text-2xl font-black">{player.number}</span>
      <span className="truncate">{player.name}</span>
    </button>
  );
}

function BigButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-16 rounded-2xl text-lg font-bold shadow-md ring-1 transition-transform touch-manipulation active:scale-95 sm:h-20 sm:text-xl',
        active ? 'bg-amber-500 text-slate-900 ring-amber-400' : 'bg-white/8 text-white ring-white/10 active:bg-white/12',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
