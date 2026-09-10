import { playerRepository } from './supabase/playerRepository';
import { matchRepository } from './supabase/matchRepository';
import { eventRepository } from './supabase/eventRepository';
import { seasonRepository } from './supabase/seasonRepository';
import type { DataProvider } from './types';

/**
 * Single seam between the app and its storage. Backed by Supabase so every
 * device sees the same data — the roster, seasons and RLS policies are set
 * up once via supabase-schema.sql, not seeded at runtime.
 */
export const dataProvider: DataProvider = {
  players: playerRepository,
  matches: matchRepository,
  events: eventRepository,
  seasons: seasonRepository,
};

/** Spanish handball-season convention: roughly August through June, spanning two calendar years. */
export function seasonNameForDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export * from './types';
