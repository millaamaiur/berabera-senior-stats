import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, fetchAllPages } from './fetchAllPages';

interface Row {
  id: string;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(5, '0')}` }));
}

/** Mimics PostgREST: honours `.range()`, but never returns more than `maxRows` rows per response. */
function fakeServer(rows: Row[], maxRows: number) {
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    const wanted = Math.min(to - from + 1, maxRows);
    return { data: rows.slice(from, from + wanted), error: null, count: rows.length };
  };
  return { fetchPage, calls };
}

describe('fetchAllPages', () => {
  it('reads past the 1000-row cap instead of silently stopping there', async () => {
    const rows = makeRows(2345);
    const { fetchPage, calls } = fakeServer(rows, 1000);
    const result = await fetchAllPages(fetchPage);
    expect(result).toHaveLength(2345);
    expect(result.at(-1)).toEqual(rows.at(-1));
    expect(calls).toEqual([
      [0, PAGE_SIZE - 1],
      [1000, 1000 + PAGE_SIZE - 1],
      [2000, 2000 + PAGE_SIZE - 1],
    ]);
  });

  it('still gets everything when the server caps responses below PAGE_SIZE', async () => {
    const rows = makeRows(25);
    const { fetchPage } = fakeServer(rows, 10);
    expect(await fetchAllPages(fetchPage)).toEqual(rows);
  });

  it('makes a single request when everything fits in one page', async () => {
    const rows = makeRows(40);
    const { fetchPage, calls } = fakeServer(rows, 1000);
    expect(await fetchAllPages(fetchPage)).toEqual(rows);
    expect(calls).toHaveLength(1);
  });

  it('returns an empty list for an empty table', async () => {
    const { fetchPage, calls } = fakeServer([], 1000);
    expect(await fetchAllPages(fetchPage)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('drops a row repeated across pages because an insert shifted it mid-read', async () => {
    const pages = [
      { data: [{ id: 'a' }, { id: 'b' }], error: null, count: 4 },
      { data: [{ id: 'b' }, { id: 'c' }, { id: 'd' }], error: null, count: 4 },
    ];
    let i = 0;
    const result = await fetchAllPages<Row>(async () => pages[i++]);
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('throws the server error instead of returning a partial list', async () => {
    const error = { code: '42501', message: 'permission denied' };
    await expect(fetchAllPages<Row>(async () => ({ data: null, error, count: null }))).rejects.toBe(error);
  });
});
