import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { createMatch } from '../stores/matchActions';
import { PinLock } from '../components/PinLock';
import { useAuthStore } from '../stores/useAuthStore';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

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
    <div className="flex flex-col gap-6 p-4">
      <h2 className="text-lg font-bold text-white">Nuevo partido</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col text-sm text-slate-300">
          Rival *
          <input
            value={opponent}
            onChange={(e) => {
              setOpponent(e.target.value);
              setOpponentError(null);
            }}
            className={[
              'mt-1 rounded-lg border-2 bg-slate-800 px-3 py-2 text-white',
              opponentError ? 'border-rose-500' : 'border-slate-600',
            ].join(' ')}
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
            className={[
              'mt-1 rounded-lg border-2 bg-slate-800 px-3 py-2 text-white',
              dateError ? 'border-rose-500' : 'border-slate-600',
            ].join(' ')}
          />
          {dateError && <span className="mt-1 text-xs font-semibold text-rose-400">{dateError}</span>}
        </label>
        <label className="flex flex-col text-sm text-slate-300">
          Competición
          <input
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
            className="mt-1 rounded-lg border-2 border-slate-600 bg-slate-800 px-3 py-2 text-white"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-slate-300">
          <input type="checkbox" checked={isHome} onChange={(e) => setIsHome(e.target.checked)} className="h-5 w-5" />
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
                'rounded-full border-2 px-3 py-2 text-sm font-semibold',
                calledIds.has(p.id) ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-600 text-slate-400',
              ].join(' ')}
            >
              {p.number} · {p.name}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={handleSubmit} className="rounded-xl bg-amber-500 py-4 text-lg font-bold text-slate-900">
        Crear partido y empezar a anotar
      </button>
    </div>
  );
}
