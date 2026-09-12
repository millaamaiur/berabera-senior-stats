import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { createMatch } from '../stores/matchActions';
import { PinLock } from '../components/PinLock';
import { useAuthStore } from '../stores/useAuthStore';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass = 'mt-1 rounded-xl bg-white/5 px-3 py-2.5 text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-amber-400';
const inputErrorClass = 'mt-1 rounded-xl bg-white/5 px-3 py-2.5 text-white ring-2 ring-rose-500 outline-none';

export function CreateMatch() {
  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);
  const navigate = useNavigate();
  const unlocked = useAuthStore((s) => s.unlocked);

  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);

  const [opponent, setOpponent] = useState('');
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [dateError, setDateError] = useState<string | null>(null);
  const [competition, setCompetition] = useState('Liga');
  const [isHome, setIsHome] = useState(true);
  const [calledIds, setCalledIds] = useState<Set<string>>(() => new Set(activePlayers.map((p) => p.id)));

  function toggleCalled(id: string) {
    setCalledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    const trimmed = opponent.trim();
    if (!trimmed) {
      setOpponentError('Indica el nombre del rival');
      return;
    }
    if (trimmed.length < 2) {
      setOpponentError('El nombre del rival es demasiado corto');
      return;
    }
    if (matches.some((m) => m.date === date)) {
      setDateError('Ya hay un partido programado ese día. Solo puede haber uno por día.');
      return;
    }
    const match = await createMatch({
      opponent: trimmed,
      date,
      competition,
      isHome,
      calledPlayerIds: [...calledIds],
    });
    navigate(`/anotar/${match.id}`);
  }

  if (!unlocked) {
    return <PinLock message="Introduce el PIN para crear un partido" />;
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 sm:p-6">
      <h2 className="text-2xl font-extrabold tracking-tight text-white">Nuevo partido</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col text-sm text-slate-300">
          Rival *
          <input
            value={opponent}
            onChange={(e) => {
              setOpponent(e.target.value);
              setOpponentError(null);
            }}
            className={opponentError ? inputErrorClass : inputClass}
            placeholder="Nombre del rival"
          />
          {opponentError && <span className="mt-1 text-xs font-semibold text-rose-400">{opponentError}</span>}
        </label>
        <label className="flex flex-col text-sm text-slate-300">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setDateError(null);
            }}
            className={dateError ? inputErrorClass : inputClass}
          />
          {dateError && <span className="mt-1 text-xs font-semibold text-rose-400">{dateError}</span>}
        </label>
        <label className="flex flex-col text-sm text-slate-300">
          Competición
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-slate-300">
          <input type="checkbox" checked={isHome} onChange={(e) => setIsHome(e.target.checked)} className="h-5 w-5 accent-amber-500" />
          Jugamos en casa
        </label>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-white">Convocatoria ({calledIds.size})</h3>
        <div className="flex flex-wrap gap-2">
          {activePlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleCalled(p.id)}
              className={[
                'rounded-full px-3 py-2 text-sm font-bold transition-transform touch-manipulation active:scale-95',
                calledIds.has(p.id) ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' : 'bg-white/5 text-slate-400 ring-1 ring-white/10',
              ].join(' ')}
            >
              {p.number} · {p.name}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="rounded-2xl bg-amber-500 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-[0.98]"
      >
        Crear partido y empezar a anotar
      </button>
    </div>
  );
}
