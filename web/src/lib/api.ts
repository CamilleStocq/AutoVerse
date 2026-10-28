export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | boolean | string[] | null | undefined>;

export function buildQuery(params: Params = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (import.meta.env.VITE_STATIC === '1') {
    if (method !== 'GET') throw new ApiError('Synchronisation indisponible dans la version en ligne.', 501);
    const { staticGet } = await import('./staticApi');
    return staticGet(path) as Promise<T>;
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.', 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `Le serveur a répondu avec une erreur (${res.status}).`, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', `${path}${buildQuery(params)}`),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};
