import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import {
  computeMatchComparison,
  computeMatchScore,
  computeTeamMatchStats,
  computeTeamZoneStats,
  matchOutcome,
} from '../stats/matchStats';
import { EventEditorModal, targetFromTimelineRow, type EventEditorTarget } from '../components/EventEditorModal';
import { formatDate } from '../utils/time';
import { MatchRosterTable } from '../components/MatchRosterTable';
import { CompactTimeline } from '../components/CompactTimeline';
import { EditSquadModal } from '../components/EditSquadModal';
import { EditMatchLinkModal } from '../components/EditMatchLinkModal';
import { StatCard } from '../components/StatCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { ComparisonBar, shareOf } from '../components/ComparisonBar';
import { GoalMomentumChart } from '../components/GoalMomentumChart';
import { updateEventAndReload, deleteEventAndReload } from '../stores/eventActions';
import { dataProvider } from '../data';
import { writeOrQueue } from '../data/offline/queue';
import { useAuthStore } from '../stores/useAuthStore';
import { TEAM_NAME } from '../config';

type Tab = 'roster' | 'stats';

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9 15l6-6" />
      <path d="M10 7l1-1a3.5 3.5 0 0 1 5 5l-1 1" />
      <path d="M14 17l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
    </svg>
  );
}

export function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const matches = useAppData((s) => s.matches);
  const players = useAppData((s) => s.players);
  const events = useAppData((s) => s.events);
  const [tab, setTab] = useState<Tab>('roster');
  const [showSquad, setShowSquad] = useState(false);
  const [showEditLink, setShowEditLink] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventEditorTarget | null>(null);
  const unlocked = useAuthStore((s) => s.unlocked);

  const match = matches.find((m) => m.id === id);
  const matchEvents = useMemo(() => events.filter((e) => e.matchId === id).sort((a, b) => a.timestamp - b.timestamp), [
    events,
    id,
  ]);

  if (!match) return <p className="p-4 text-white">Partido no encontrado.</p>;

  const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
  const outcome = matchOutcome(goalsFor, goalsAgainst);
  const team = computeTeamMatchStats(matchEvents);
  const comparison = computeMatchComparison(matchEvents);
  const attackZones = computeTeamZoneStats(matchEvents, 'shot');
  const concededZones = computeTeamZoneStats(matchEvents, 'gk_shot');
  const maxAttackShots = Math.max(1, ...attackZones.map((z) => z.shots));
  const maxConcededShots = Math.max(1, ...concededZones.map((z) => z.shots));
  const roster = players.filter((p) => match.calledPlayerIds.includes(p.id));
  const onCourtIdsAtEnd = new Set(matchEvents.filter((e) => e.eventType === 'court_change').map((e) => e.playerId));
  const lockedPlayerIds = new Set([...onCourtIdsAtEnd, ...matchEvents.map((e) => e.playerId)]);

  async function handleSaveSquad(calledPlayerIds: string[]) {
    const updated = { ...match!, calledPlayerIds };
    useAppData.setState((s) => ({ matches: s.matches.map((m) => (m.id === updated.id ? updated : m)) }));
    await writeOrQueue({ collection: 'matches', method: 'upsert', payload: updated }, () => dataProvider.matches.upsert(updated));
  }

  async function handleSaveLink(link: string | null) {
    const updated = { ...match!, link };
    useAppData.setState((s) => ({ matches: s.matches.map((m) => (m.id === updated.id ? updated : m)) }));
    await writeOrQueue({ collection: 'matches', method: 'upsert', payload: updated }, () => dataProvider.matches.upsert(updated));
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-6 sm:p-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{TEAM_NAME} vs {match.opponent}</h2>
          <p className="text-slate-400">
            {formatDate(match.date)} · {match.competition} · {match.isHome ? 'Casa' : 'Fuera'}
          </p>
          <p className="mt-3 text-4xl font-black text-white">
            {goalsFor} - {goalsAgainst}
            <span className="ml-3 text-base font-semibold text-amber-400">
              {outcome === 'win' ? 'Victoria' : outcome === 'loss' ? 'Derrota' : 'Empate'}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {match.link && (
              <a
                href={match.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-400 transition-transform touch-manipulation active:scale-95"
              >
                <LinkIcon /> Ver enlace
              </a>
            )}
            {unlocked && (
              <button
                type="button"
                onClick={() => setShowEditLink(true)}
                className="rounded-full bg-white/8 px-3.5 py-2 text-xs font-bold text-slate-200 transition-transform touch-manipulation active:scale-95"
              >
                {match.link ? 'Editar enlace' : '+ Añadir enlace'}
              </button>
            )}
          </div>
        </div>
        <GoalMomentumChart events={matchEvents} durationSeconds={match.clock.elapsedSeconds} />
      </div>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'roster', label: 'Tabla de puntos' },
          { value: 'stats', label: 'Estadísticas' },
        ]}
      />

      {tab === 'roster' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[7fr_3fr]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Jugadores convocados</h3>
              {unlocked && (
                <button
                  type="button"
                  onClick={() => setShowSquad(true)}
                  className="rounded-full bg-white/8 px-3.5 py-2 text-xs font-bold text-slate-200 transition-transform touch-manipulation active:scale-95"
                >
                  Editar convocatoria
                </button>
              )}
            </div>
            <MatchRosterTable roster={roster} matchEvents={matchEvents} elapsedSeconds={match.clock.elapsedSeconds} compact />
          </section>
          <section className="min-w-0">
            <h3 className="mb-3 text-lg font-bold text-white">Timeline</h3>
            <div className="max-h-[560px] overflow-y-auto pr-1">
              <CompactTimeline
                events={matchEvents}
                players={players}
                onRowClick={unlocked ? (row) => setEditingEvent(targetFromTimelineRow(row, players)) : undefined}
              />
            </div>
          </section>
        </div>
      ) : (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-center gap-6 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> {TEAM_NAME}
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> {match.opponent}
              </span>
            </div>
            <ComparisonBar
              label="Eficiencia en el disparo"
              leftValue={`${comparison.us.goals}/${comparison.us.attempts} (${comparison.us.shotPct}%)`}
              rightValue={`${comparison.rival.goals}/${comparison.rival.attempts} (${comparison.rival.shotPct}%)`}
              leftShare={shareOf(comparison.us.shotPct, comparison.rival.shotPct)}
            />
            <ComparisonBar
              label="Paradas"
              leftValue={`${comparison.ourSaves}/${comparison.ourShotsFaced} (${comparison.ourSavePct}%)`}
              rightValue={`${comparison.rivalSaves}/${comparison.rivalShotsFaced} (${comparison.rivalSavePct}%)`}
              leftShare={shareOf(comparison.ourSavePct, comparison.rivalSavePct)}
            />
            <ComparisonBar
              label="Goles en juego"
              leftValue={String(comparison.us.openPlayGoals)}
              rightValue={String(comparison.rival.openPlayGoals)}
              leftShare={shareOf(comparison.us.openPlayGoals, comparison.rival.openPlayGoals)}
            />
            <ComparisonBar
              label="7 metros"
              leftValue={`${comparison.us.penaltiesScored}/${comparison.us.penaltiesTaken}`}
              rightValue={`${comparison.rival.penaltiesScored}/${comparison.rival.penaltiesTaken}`}
              leftShare={shareOf(comparison.us.penaltiesScored, comparison.rival.penaltiesScored)}
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nuestro equipo</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Pérdidas" value={team.turnovers} />
              <StatCard label="Recup." value={team.recoveries} />
              <StatCard label="Amonest." value={team.yellowCards + team.redCards + team.blueCards} />
              <StatCard label="Exclus." value={team.exclusions} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-slate-500">Zonas de gol del equipo</p>
              <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
                {attackZones.map((z) => (
                  <div
                    key={z.zone}
                    className="rounded-xl p-2 text-center text-white ring-1 ring-white/10"
                    style={{ backgroundColor: `rgba(37, 99, 235, ${z.shots > 0 ? 0.18 + 0.62 * (z.shots / maxAttackShots) : 0})` }}
                  >
                    <p className="text-xs text-slate-300">Zona {z.zone}</p>
                    <p className="font-bold">
                      {z.goals}/{z.shots}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-slate-500">Zonas de gol encajadas</p>
              <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
                {concededZones.map((z) => (
                  <div
                    key={z.zone}
                    className="rounded-xl p-2 text-center text-white ring-1 ring-white/10"
                    style={{ backgroundColor: `rgba(244, 63, 94, ${z.shots > 0 ? 0.18 + 0.62 * (z.shots / maxConcededShots) : 0})` }}
                  >
                    <p className="text-xs text-slate-300">Zona {z.zone}</p>
                    <p className="font-bold">
                      {z.goals}/{z.shots}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {showSquad && (
        <EditSquadModal
          allPlayers={players.filter((p) => p.active)}
          calledPlayerIds={match.calledPlayerIds}
          lockedPlayerIds={lockedPlayerIds}
          onSave={handleSaveSquad}
          onClose={() => setShowSquad(false)}
        />
      )}

      {editingEvent && (
        <EventEditorModal
          target={editingEvent}
          onUpdateEvent={updateEventAndReload}
          onDeleteEvent={deleteEventAndReload}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {showEditLink && <EditMatchLinkModal match={match} onSave={handleSaveLink} onClose={() => setShowEditLink(false)} />}
    </div>
  );
}
