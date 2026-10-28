import { getDb } from '../db.ts';

export interface Cached<T> {
  data: T;
  fetchedAt: string; // ISO — date de récupération réelle auprès de la source
  stale: boolean; // true si la source a échoué et qu'on sert la dernière copie connue
  error?: string;
}

const inflight = new Map<string, Promise<Cached<unknown>>>();

/**
 * Lecture « stale-if-error » persistée en SQLite :
 * - copie fraîche → servie telle quelle ;
 * - copie expirée → on tente la source ; si elle échoue, on sert la copie avec `stale: true` ;
 * - aucune copie et source en échec → l'erreur remonte à l'appelant.
 * Les appels concurrents sur la même clé sont mutualisés (limite les requêtes aux API).
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<Cached<T>> {
  const db = getDb();
  const row = db.prepare('SELECT value, fetched_at, expires_at FROM http_cache WHERE key = ?').get(key) as
    | { value: string; fetched_at: string; expires_at: number }
    | undefined;
  if (row && row.expires_at > Date.now()) {
    return { data: JSON.parse(row.value) as T, fetchedAt: row.fetched_at, stale: false };
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<Cached<T>>;

  const run = (async (): Promise<Cached<T>> => {
    try {
      const data = await loader();
      const fetchedAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO http_cache (key, value, fetched_at, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
      ).run(key, JSON.stringify(data), fetchedAt, Date.now() + ttlMs);
      return { data, fetchedAt, stale: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (row) return { data: JSON.parse(row.value) as T, fetchedAt: row.fetched_at, stale: true, error: message };
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}
