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

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Rien à faire : la valeur sera simplement ignorée.
  }
}

let persistRequested = false;

/**
 * Demande au navigateur de ne jamais effacer automatiquement les données de l'application
 * (sinon purgeables en cas de manque d'espace, ou après 7 jours d'inactivité sur Safari).
 * Appelé quand l'utilisateur enregistre quelque chose (préférences, favori).
 */
export function requestPersistentStorage(): void {
  if (persistRequested || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  persistRequested = true;
  navigator.storage.persisted()
    .then((already) => (already ? true : navigator.storage.persist()))
    .catch(() => undefined);
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
  alerts: 'autoverse.alerts',
  onboardingDraft: 'autoverse.onboardingDraft',
  collection: 'autoverse.collection',
} as const;
