import { useState } from 'react';
import type { Player } from '../domain/types';
import { useTimedMessage } from '../utils/useTimedMessage';
import { COURT_LIMITS } from '../stores/useLiveMatchStore';

interface SubstitutionModalProps {
  onCourtPlayers: Player[];
  benchPlayers: Player[];
  onConfirm: (outIds: string[], inIds: string[]) => Promise<string[]>;
  onClose: () => void;
}

/**
 * Pick who leaves the court and who comes in from the bench, then apply the
 * whole swap at once — as a single atomic batch sharing one timestamp, so it
 * always shows up as one paired "cambio" in the timeline.
 */
export function SubstitutionModal({ onCourtPlayers, benchPlayers, onConfirm, onClose }: SubstitutionModalProps) {
  const [outIds, setOutIds] = useState<Set<string>>(new Set());
  const [inIds, setInIds] = useState<Set<string>>(new Set());
  const { message, show } = useTimedMessage(2500);

  function toggle(set: Set<string>, setter: (next: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function handleConfirm() {
    const outPlayers = onCourtPlayers.filter((p) => outIds.has(p.id));
    const inPlayers = benchPlayers.filter((p) => inIds.has(p.id));
    const outField = outPlayers.filter((p) => p.position === 'player').length;
    const outGk = outPlayers.filter((p) => p.position === 'goalkeeper').length;
    const inField = inPlayers.filter((p) => p.position === 'player').length;
    const inGk = inPlayers.filter((p) => p.position === 'goalkeeper').length;
    const currentField = onCourtPlayers.filter((p) => p.position === 'player').length;
    const currentGk = onCourtPlayers.filter((p) => p.position === 'goalkeeper').length;

    // The court must always end up with exactly 6 jugadores + 1 portero — never
    // fewer. This is enforced as a same-position swap (jugador por jugador,
    // portero por portero) when the court is already full, but also lets you
    // top up a court that's short a player (e.g. after an accidental Deshacer)
    // by only bringing someone in, without forcing you to remove anyone else.
    // Checked up front so a rejected combination never touches the court.
    if (
      currentField - outField + inField !== COURT_LIMITS.player ||
      currentGk - outGk + inGk !== COURT_LIMITS.goalkeeper
    ) {
      show(
        `El equipo tiene que quedar siempre con ${COURT_LIMITS.player} jugadores de campo y ${COURT_LIMITS.goalkeeper} portero en pista. Ajusta la selección.`
      );
      return;
    }

    const rejected = await onConfirm([...outIds], [...inIds]);
    if (rejected.length > 0) {
      show('Algún jugador no ha podido entrar: no había hueco libre en su posición');
      return;
    }
    onClose();
  }

  const canConfirm = outIds.size > 0 || inIds.size > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border-2 border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Hacer cambios</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400" aria-label="Cerrar">
            ×
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-300">Salen (en pista) — toca para marcar</p>
          <div className="flex flex-wrap gap-2">
            {onCourtPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => toggle(outIds, setOutIds, player.id)}
                className={chipClass(player, outIds.has(player.id), 'rose')}
              >
                <span className="opacity-60">{player.number}</span> {player.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-300">Entran (banquillo) — toca para marcar</p>
          <div className="flex flex-wrap gap-2">
            {benchPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => toggle(inIds, setInIds, player.id)}
                className={chipClass(player, inIds.has(player.id), 'emerald')}
              >
                <span className="opacity-60">{player.number}</span> {player.name}
              </button>
            ))}
            {benchPlayers.length === 0 && <p className="text-sm text-slate-500">No hay nadie en el banquillo</p>}
          </div>
        </div>

        {message && <p className="text-sm font-semibold text-rose-400">{message}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3">
          <p className="text-sm text-slate-400">
            Salen: {outIds.size} · Entran: {inIds.size}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-900 disabled:opacity-40"
            >
              Confirmar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function chipClass(player: Player, marked: boolean, markColor: 'rose' | 'emerald'): string {
  const base = 'flex h-12 items-center justify-center gap-1 rounded-lg border-2 px-3 font-bold touch-manipulation';
  const posColor =
    player.position === 'goalkeeper'
      ? 'border-sky-500 bg-sky-500/10 text-sky-300'
      : 'border-slate-500 bg-slate-700 text-white';
  const markClass = marked ? (markColor === 'rose' ? 'ring-4 ring-rose-400' : 'ring-4 ring-emerald-400') : '';
  return [base, posColor, markClass].join(' ');
}
