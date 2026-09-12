export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Whole calendar days between today and the given ISO date (negative if it's in the past). */
export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "Hoy" / "En 3 días" / "Pendiente" (for a date already in the past) from an ISO date. */
export function scheduleLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days === 0) return 'Hoy';
  if (days > 0) return `En ${days} día${days === 1 ? '' : 's'}`;
  return 'Pendiente';
}
