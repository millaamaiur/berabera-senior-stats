import type { MatchEvent, Player } from '../domain/types';
import { RIVAL_ID } from '../domain/types';

export const EVENT_LABELS: Record<MatchEvent['eventType'], string> = {
  shot: 'Lanzamiento',
  gk_shot: 'Lanzamiento recibido',
  assist: 'Asistencia',
  turnover: 'Pérdida',
  steps: 'Pasos',
  card_yellow: 'Amarilla',
  card_red: 'Roja',
  card_blue: 'Azul',
  exclusion_2min: '2 minutos',
  court_change: 'Cambio de pista',
  opponent_attack: 'Ataque rival',
};

const RESULT_LABELS: Record<string, string> = {
  goal: 'Gol',
  miss: 'Fallo',
  save: 'Parada',
  stopped: 'Fallado',
};

/** Short human description of an event's extra detail (result, zone, enter/exit), if any. */
export function describeEventDetail(event: MatchEvent): string | null {
  switch (event.eventType) {
    case 'shot':
      return `${RESULT_LABELS[event.eventData.result]} · zona ${event.eventData.zone}`;
    case 'gk_shot':
      return `${RESULT_LABELS[event.eventData.result]} · zona ${event.eventData.zone}${
        event.eventData.context === 'penalty' ? ' · penalti' : ''
      }`;
    case 'court_change':
      return event.eventData.action === 'enter' ? 'Entra a pista' : 'Sale de pista';
    case 'opponent_attack':
      return RESULT_LABELS[event.eventData.result];
    default:
      return null;
  }
}

/** Display name for whoever an event is "about" — "Rival" for team-level opponent events. */
export function playerLabelFor(event: MatchEvent, players: Player[]): string {
  if (event.playerId === RIVAL_ID) return 'Rival';
  return players.find((p) => p.id === event.playerId)?.name ?? '—';
}
