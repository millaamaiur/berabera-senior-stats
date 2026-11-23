import { useState, type ReactNode } from 'react';
import type { CourtSpot, Phase, Player } from '../domain/types';
import { positionForSpot, SPOT_LABELS } from '../stats/courtSpots';
import { AttackDefenseBar, MAX_AD_PAIRS, type PairView } from './AttackDefenseBar';
import { CourtView, type CourtMode, type SuspendedSpot } from './CourtView';

/** What the court needs to know about attack-defense pairs; only used while recording ('actions'). */
export interface AttackDefenseProps {
  pairs: PairView[];
  phase: Phase | null;
  onSwitch: (to: Phase) => void;
  onTapPair: (pair: PairView) => void;
  /** `role` is what `onCourt` plays: the phase they're in now. */
  onCreatePair: (onCourt: Player, partner: Player, role: Phase) => void;
}

interface CourtPanelProps {
  mode: Exclude<CourtMode, 'pair'>;
  spots: Map<CourtSpot, Player>;
  /** Everyone called up who isn't on court right now (and not waiting in a pair). */
  benchPlayers: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  /** Puts `incoming` on `spot`, taking `outgoing` (whoever stood there, if anyone) off court. */
  onFillSpot: (spot: CourtSpot, incoming: Player, outgoing: Player | null) => Promise<void>;
  /** Lineup only: leaves a spot empty again. */
  onClearSpot: (player: Player) => Promise<void>;
  attackDefense?: AttackDefenseProps;
  /** Spots counting down a suspension. */
  suspendedSpots?: Map<CourtSpot, SuspendedSpot>;
  /** "Jugáis con 5 de campo · vuelve Ane en 1:42", while any suspension runs. */
  suspensionHint?: string;
}

/** Starting a pair: the on-court player first, then their partner, then (first pair only) who attacks. */
type Pairing = { step: 'court' } | { step: 'bench'; player: Player } | { step: 'roles'; player: Player; partner: Player };

/**
 * The left half of the scoring screen while no action is being finished: the
 * court, or — after tapping a spot to fill or a player to swap — who can go
 * there. While recording, the attack-defense bar sits on top of the court.
 */
export function CourtPanel({
  mode,
  spots,
  benchPlayers,
  selectedPlayerId,
  onSelectPlayer,
  onFillSpot,
  onClearSpot,
  attackDefense,
  suspendedSpots,
  suspensionHint,
}: CourtPanelProps) {
  const [pickingSpot, setPickingSpot] = useState<CourtSpot | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);

  const pairedIds = new Set(attackDefense?.pairs.flatMap((p) => [p.attacker.id, p.defender.id]) ?? []);
  const spotOf = new Map([...spots].map(([spot, player]) => [player.id, spot]));

  function handleTapSpot(spot: CourtSpot, player: Player | null) {
    if (pairing?.step === 'court') {
      if (player) setPairing({ step: 'bench', player });
      return;
    }
    if (mode === 'actions' && player) {
      onSelectPlayer(player.id === selectedPlayerId ? null : player.id);
      return;
    }
    onSelectPlayer(null);
    setPickingSpot(spot);
  }

  /**
   * Back to the court straight away: the store puts the change on screen
   * before it's uploaded, so a slow connection in the hall never leaves this
   * list hanging (and a second tap can't land on it twice).
   */
  function run(task: () => Promise<void>) {
    setPickingSpot(null);
    void task();
  }

  function finishPair(player: Player, partner: Player, role: Phase) {
    setPairing(null);
    attackDefense?.onCreatePair(player, partner, role);
  }

  if (attackDefense && pairing?.step === 'roles') {
    const { player, partner } = pairing;
    return (
      <div className="flex h-full flex-col gap-3">
        <PanelHeader
          title={`Pareja ${player.number} ⇄ ${partner.number}`}
          subtitle="¿Quién juega en ataque y quién en defensa?"
          onCancel={() => setPairing(null)}
        />
        <RoleButton attacker={player} defender={partner} onClick={() => finishPair(player, partner, 'attack')} />
        <RoleButton attacker={partner} defender={player} onClick={() => finishPair(player, partner, 'defense')} />
        <p className="text-sm text-slate-400">
          {player.name} está en pista: si es el de ataque, ahora estáis atacando; si es el de defensa, defendiendo.
        </p>
      </div>
    );
  }

  if (attackDefense && pairing?.step === 'bench') {
    const { player } = pairing;
    const spot = spotOf.get(player.id);
    const candidates = benchPlayers.filter((p) => p.position === 'player').sort((a, b) => a.number - b.number);
    return (
      <div className="flex h-full flex-col gap-3">
        <PanelHeader
          title={`¿Quién se cambia con ${player.name}?`}
          subtitle={`${spot ? `${SPOT_LABELS[spot]} · ` : ''}uno juega en ataque y el otro en defensa`}
          onCancel={() => setPairing(null)}
        />
        <PlayerGrid
          players={candidates}
          onPick={(partner) => {
            const { phase } = attackDefense;
            // Once the court is in a phase, whoever is on court plays it; only the first pair has to ask.
            if (phase) finishPair(player, partner, phase);
            else setPairing({ step: 'roles', player, partner });
          }}
        />
        {candidates.length === 0 && (
          <p className="text-sm text-slate-400">No queda ningún jugador de campo libre en el banquillo.</p>
        )}
      </div>
    );
  }

  if (pickingSpot) {
    const current = spots.get(pickingSpot) ?? null;
    const kind = positionForSpot(pickingSpot);
    const candidates = benchPlayers.filter((p) => p.position === kind).sort((a, b) => a.number - b.number);
    const spotLabel = SPOT_LABELS[pickingSpot];
    const title =
      mode === 'lineup'
        ? `¿Quién juega de ${spotLabel.toLowerCase()}?`
        : current
          ? `¿Quién entra por ${current.name}?`
          : `¿Quién entra de ${spotLabel.toLowerCase()}?`;
    const subtitle =
      mode === 'lineup'
        ? current
          ? `Ahora: ${current.name}`
          : undefined
        : current && pairedIds.has(current.id)
          ? `${spotLabel} · el que entre se queda con su sitio en la pareja`
          : spotLabel;

    return (
      <div className="flex h-full flex-col gap-3">
        <PanelHeader title={title} subtitle={subtitle} onCancel={() => setPickingSpot(null)} />
        <PlayerGrid players={candidates} onPick={(player) => run(() => onFillSpot(pickingSpot, player, current))} />
        {candidates.length === 0 && (
          <p className="text-sm text-slate-400">
            {kind === 'goalkeeper'
              ? 'No hay ningún portero convocado en el banquillo. Añádelo en «Convocatoria».'
              : 'No hay ningún jugador de campo convocado en el banquillo. Añádelo en «Convocatoria».'}
          </p>
        )}

        {mode === 'lineup' && current && (
          <button
            type="button"
            onClick={() => run(() => onClearSpot(current))}
            className="self-start rounded-full px-4 py-2.5 font-semibold text-rose-400 ring-1 ring-rose-400/40 touch-manipulation active:scale-95"
          >
            Quitar a {current.name}
          </button>
        )}
      </div>
    );
  }

  const partnerOf = new Map<string, Player>();
  for (const pair of attackDefense?.pairs ?? []) {
    partnerOf.set(pair.attacker.id, pair.defender);
    partnerOf.set(pair.defender.id, pair.attacker);
  }

  if (attackDefense && pairing?.step === 'court') {
    return (
      <div className="flex h-full flex-col gap-2">
        <PanelHeader
          title="Nueva pareja ataque-defensa"
          subtitle="Toca al jugador de pista que se va a cambiar"
          subtitleClass="font-semibold text-amber-400"
          onCancel={() => setPairing(null)}
        />
        <CourtView
          spots={spots}
          mode="pair"
          selectedPlayerId={null}
          onTapSpot={handleTapSpot}
          partnerOf={partnerOf}
          unavailableIds={pairedIds}
          suspendedSpots={suspendedSpots}
        />
      </div>
    );
  }

  const selected = [...spots.values()].find((p) => p.id === selectedPlayerId);
  const showBar = mode === 'actions' && attackDefense;
  const phaseWord =
    showBar && attackDefense.phase ? (attackDefense.phase === 'attack' ? 'Atacando · ' : 'Defendiendo · ') : '';
  const hint =
    mode === 'lineup'
      ? 'Toca un hueco del campo y elige quién juega ahí'
      : mode === 'subs'
        ? 'Toca al jugador que sale'
        : selected
          ? `${selected.name} · elige la acción arriba`
          : (suspensionHint ?? `${phaseWord}Toca a un jugador y luego la acción`);
  const hintColor =
    mode === 'subs' ? 'text-rose-400' : selected ? 'text-amber-400' : suspensionHint && mode === 'actions' ? 'text-rose-400' : 'text-slate-400';

  return (
    <div className="flex h-full flex-col gap-2">
      {showBar && (
        <AttackDefenseBar
          pairs={attackDefense.pairs}
          phase={attackDefense.phase}
          canAddPair={attackDefense.pairs.length < MAX_AD_PAIRS}
          onSwitch={(to) => {
            onSelectPlayer(null);
            attackDefense.onSwitch(to);
          }}
          onAddPair={() => {
            onSelectPlayer(null);
            setPairing({ step: 'court' });
          }}
          onTapPair={attackDefense.onTapPair}
        />
      )}
      <p className={`shrink-0 text-center text-sm font-semibold ${hintColor}`}>{hint}</p>
      <CourtView
        spots={spots}
        mode={mode}
        selectedPlayerId={selectedPlayerId}
        onTapSpot={handleTapSpot}
        partnerOf={partnerOf}
        suspendedSpots={mode === 'lineup' ? undefined : suspendedSpots}
      />
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  subtitleClass = 'text-slate-400',
  onCancel,
}: {
  title: string;
  subtitle?: ReactNode;
  subtitleClass?: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3">
      <div>
        <p className="text-lg font-bold text-white">{title}</p>
        {subtitle && <p className={`text-sm ${subtitleClass}`}>{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-full bg-white/8 px-4 py-2.5 font-semibold text-white ring-1 ring-white/10 touch-manipulation active:scale-95"
      >
        Cancelar
      </button>
    </div>
  );
}

function PlayerGrid({ players, onPick }: { players: Player[]; onPick: (player: Player) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          onClick={() => onPick(player)}
          className={[
            'flex h-16 items-center gap-2 rounded-2xl px-3 text-left font-bold ring-1 transition-transform touch-manipulation active:scale-95',
            player.position === 'goalkeeper' ? 'bg-sky-500/10 text-sky-300 ring-sky-500/40' : 'bg-white/8 text-white ring-white/10',
          ].join(' ')}
        >
          <span className="text-2xl font-black">{player.number}</span>
          <span className="truncate">{player.name}</span>
        </button>
      ))}
    </div>
  );
}

function RoleButton({ attacker, defender, onClick }: { attacker: Player; defender: Player; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-20 items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 text-left ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.98]"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-bold tracking-wider text-amber-400">ATAQUE</span>
        <span className="truncate text-lg font-extrabold text-white">
          {attacker.number} · {attacker.name}
        </span>
      </span>
      <span aria-hidden="true" className="text-xl text-slate-400">
        ⇄
      </span>
      <span className="flex min-w-0 flex-col items-end text-right">
        <span className="text-xs font-bold tracking-wider text-sky-400">DEFENSA</span>
        <span className="truncate text-lg font-extrabold text-white">
          {defender.number} · {defender.name}
        </span>
      </span>
    </button>
  );
}
