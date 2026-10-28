/** Accès localStorage tolérant (navigation privée, stockage plein ou bloqué). */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible : l'état reste en mémoire et sera envoyé au serveur.
  }
}

export const KEYS = {
  profileId: 'autoverse.profileId',
  profile: 'autoverse.profile',
  wishlist: 'autoverse.wishlist',
  pending: 'autoverse.pendingSync',
  compare: 'autoverse.compare',
  theme: 'autoverse.theme',
  history: 'autoverse.history',
  exploreView: 'autoverse.exploreView',
} as const;
