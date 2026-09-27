import type { MatchEvent } from '../domain/types';

export const EVENT_LABELS: Record<MatchEvent['eventType'], string> = {
  shot: 'Lanzamiento',
  gk_shot: 'Lanzamiento recibido',
  assist: 'Asistencia',
  turnover: 'Pérdida',
  recovery: 'Recuperación',
  steps: 'Pasos',
  card_yellow: 'Amarilla',
  card_red: 'Roja',
  card_blue: 'Azul',
  exclusion_2min: '2 minutos',
  court_change: 'Cambio de pista',
};

const RESULT_LABELS: Record<string, string> = {
  goal: 'Gol',
  miss: 'Fallo',
  save: 'Parada',
};

/** Short human description of an event's extra detail (result, zone, enter/exit), if any. */
export function describeEventDetail(event: MatchEvent): string | null {
  switch (event.eventType) {
    case 'shot':
      return `${RESULT_LABELS[event.eventData.result]}${event.eventData.context === 'penalty' ? ' · penalti' : ''}`;
    case 'gk_shot': {
      const label = event.eventData.result === 'miss' ? 'Fuera' : RESULT_LABELS[event.eventData.result];
      const zonePart = event.eventData.zone !== undefined ? ` · zona ${event.eventData.zone}` : '';
      return `${label}${zonePart}${event.eventData.context === 'penalty' ? ' · penalti' : ''}`;
    }
    case 'court_change':
      return event.eventData.action === 'enter' ? 'Entra a pista' : 'Sale de pista';
    default:
      return null;
  }
}

/** One-line confirmation for the toast shown right after recording a live event. */
export function describeEventForToast(event: MatchEvent, playerName: string): string {
  switch (event.eventType) {
    case 'shot':
      return event.eventData.result === 'goal' ? `¡Gol de ${playerName}!` : `Fallo de ${playerName}`;
    case 'gk_shot':
      if (event.eventData.result === 'goal') return `Gol encajado (${playerName})`;
      return event.eventData.result === 'miss' ? 'Tiro fuera' : `Parada de ${playerName}`;
    default:
      return `${EVENT_LABELS[event.eventType]} · ${playerName}`;
  }
}
