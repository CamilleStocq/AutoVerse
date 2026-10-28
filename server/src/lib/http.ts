import { config } from '../config.ts';

export class UpstreamError extends Error {
  readonly source: string;
  readonly status?: number;
  constructor(source: string, message: string, status?: number) {
    super(`${source}: ${message}`);
    this.source = source;
    this.status = status;
  }
}

/** fetch avec délai maximal, User-Agent explicite et erreurs normalisées. */
export async function fetchText(url: string, source: string, timeoutMs = 12_000): Promise<string> {
  if (config.offline) throw new UpstreamError(source, 'mode hors ligne');
  // Les API publiques limitent le débit (HTTP 429) : jusqu'à 3 tentatives, en respectant Retry-After.
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': config.userAgent, Accept: '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
    } catch (e) {
      throw new UpstreamError(source, e instanceof Error ? e.message : 'réseau indisponible');
    }
    if (res.status === 429 && attempt < 2) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 2000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) throw new UpstreamError(source, `HTTP ${res.status}`, res.status);
    return res.text();
  }
}

export async function fetchJson<T = unknown>(url: string, source: string, timeoutMs?: number): Promise<T> {
  const text = await fetchText(url, source, timeoutMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(source, 'réponse JSON invalide');
  }
}
