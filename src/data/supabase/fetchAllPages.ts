/**
 * Rows requested per round-trip. Supabase (PostgREST) caps every response at
 * the project's "Max rows" setting — 1000 by default — and anything past that
 * is silently left out: no error, just a short list. A plain `select('*')` on
 * `events` therefore stops returning the newest rows once the season passes
 * 1000 events in total, which shows up as a finished match missing half its
 * goals.
 */
export const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
  count: number | null;
}

/**
 * Reads a whole table (or filtered query) page by page until every row is in.
 * `fetchPage` must ask for `{ count: 'exact' }` and a stable `order(...)`, and
 * apply `.range(from, to)`. The total count is what decides when to stop, so it
 * still gets every row if the project's "Max rows" is lower than PAGE_SIZE.
 * Rows are de-duplicated by id in case an insert lands mid-read and shifts a
 * row from one page into the next.
 */
export async function fetchAllPages<T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const byId = new Map<string, T>();
  let offset = 0;
  for (;;) {
    const { data, error, count } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    for (const row of page) byId.set(row.id, row);
    offset += page.length;
    if (page.length === 0) break;
    if (count !== null ? offset >= count : page.length < PAGE_SIZE) break;
  }
  return [...byId.values()];
}
