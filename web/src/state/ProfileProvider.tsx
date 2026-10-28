/**
 * Profil, préférences et wishlist.
 * - Écriture immédiate en local (l'interface réagit sans attendre le réseau).
 * - Synchronisation serveur (SQLite) ; en cas d'échec, l'opération est mise en file
 *   et rejouée au retour de la connexion. Rien n'est perdu à la fermeture de l'application.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CarSummary } from '@shared/api';
import { DEFAULT_PREFERENCES, type Preferences, type Profile, type WishlistEntry } from '@shared/profile';
import { api, ApiError } from '../lib/api';
import { KEYS, readLocal, requestPersistentStorage, writeLocal } from './storage';
import { readCollection, setCollectionState, type CollectionState } from './collection';

type PendingOp =
  | { kind: 'profile' }
  | { kind: 'wish-put'; entry: WishlistEntry }
  | { kind: 'wish-delete'; generationId: string };

export type SyncState = 'synced' | 'syncing' | 'pending' | 'local';

/** Version hébergée sans serveur : tout reste sur l'appareil (export/import pour changer d'appareil). */
export const SERVER_SYNC = import.meta.env.VITE_STATIC !== '1';

export interface ExportedData {
  format: 'autoverse-backup';
  version: 1;
  exportedAt: string;
  preferences: Preferences;
  onboardedAt: string | null;
  wishlist: WishlistEntry[];
  /** Collection de cartes (absente des sauvegardes plus anciennes). */
  collection?: CollectionState;
}

interface ProfileContextValue {
  profileId: string;
  profile: Profile;
  preferences: Preferences;
  isOnboarded: boolean;
  savePreferences: (prefs: Preferences, opts?: { completeOnboarding?: boolean }) => void;
  resetOnboarding: () => void;
  wishlist: WishlistEntry[];
  isWished: (id: string) => boolean;
  toggleWish: (car: CarSummary) => boolean;
  removeWish: (id: string) => void;
  syncState: SyncState;
  linkProfile: (id: string) => Promise<void>;
  exportData: () => ExportedData;
  importData: (data: unknown) => number;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function initialProfileId(): string {
  const existing = readLocal<string | null>(KEYS.profileId, null);
  if (existing) return existing;
  const id = newId();
  writeLocal(KEYS.profileId, id);
  return id;
}

function emptyProfile(id: string): Profile {
  return { id, onboardedAt: null, preferences: DEFAULT_PREFERENCES, updatedAt: new Date(0).toISOString() };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profileId, setProfileId] = useState(initialProfileId);
  const [profile, setProfile] = useState<Profile>(() => readLocal(KEYS.profile, emptyProfile(profileId)));
  const [wishlist, setWishlist] = useState<WishlistEntry[]>(() => readLocal(KEYS.wishlist, []));
  const [pending, setPending] = useState<PendingOp[]>(() => readLocal(KEYS.pending, []));
  const [syncing, setSyncing] = useState(false);
  // Après un échec réseau, on attend 30 s (ou le retour en ligne) avant de réessayer.
  const [backoffUntil, setBackoffUntil] = useState(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const wishlistRef = useRef(wishlist);
  wishlistRef.current = wishlist;

  // Écriture synchrone dès que l'état change (avant même l'affichage), pour qu'une fermeture
  // immédiate de l'application ne perde jamais la dernière action.
  useLayoutEffect(() => writeLocal(KEYS.profile, profile), [profile]);
  useLayoutEffect(() => writeLocal(KEYS.wishlist, wishlist), [wishlist]);
  useLayoutEffect(() => writeLocal(KEYS.pending, pending), [pending]);

  // Filet de sécurité : sauvegarde au moment où l'application passe en arrière-plan ou se ferme.
  useEffect(() => {
    const flush = () => {
      writeLocal(KEYS.profile, profileRef.current);
      writeLocal(KEYS.wishlist, wishlistRef.current);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const enqueue = useCallback((op: PendingOp) => {
    if (!SERVER_SYNC) return;
    setPending((list) => {
      // Une seule opération en attente par cible : la plus récente l'emporte.
      const key = (o: PendingOp) => (o.kind === 'profile' ? 'profile' : o.kind === 'wish-put' ? o.entry.generationId : o.generationId);
      return [...list.filter((o) => key(o) !== key(op)), op];
    });
  }, []);

  const flush = useCallback(async (ops: PendingOp[], id: string) => {
    if (!ops.length) return;
    setSyncing(true);
    const failed: PendingOp[] = [];
    for (const op of ops) {
      try {
        if (op.kind === 'profile') {
          const p = profileRef.current;
          await api.put(`/profile/${id}`, { onboardedAt: p.onboardedAt, preferences: p.preferences });
        } else if (op.kind === 'wish-put') {
          await api.put(`/profile/${id}/wishlist/${encodeURIComponent(op.entry.generationId)}`, { addedAt: op.entry.addedAt, snapshot: op.entry.snapshot });
        } else {
          await api.delete(`/profile/${id}/wishlist/${encodeURIComponent(op.generationId)}`);
        }
      } catch (e) {
        if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) failed.push(op);
      }
    }
    setPending((list) => [...failed, ...list.filter((o) => !ops.includes(o))]);
    setBackoffUntil(failed.length ? Date.now() + 30_000 : 0);
    setSyncing(false);
  }, []);

  // Chargement initial : réconciliation avec le serveur.
  useEffect(() => {
    if (!SERVER_SYNC) return;
    let cancelled = false;
    (async () => {
      const queued = readLocal<PendingOp[]>(KEYS.pending, []);
      try {
        const remote = await api.get<Profile | null>(`/profile/${profileId}`);
        if (!remote) {
          if (profileRef.current.onboardedAt) enqueue({ kind: 'profile' });
        } else if (!cancelled && Date.parse(remote.updatedAt) > Date.parse(profileRef.current.updatedAt) && !queued.some((o) => o.kind === 'profile')) {
          setProfile(remote);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && profileRef.current.onboardedAt) enqueue({ kind: 'profile' });
      }
      try {
        const remote = await api.get<WishlistEntry[]>(`/profile/${profileId}/wishlist`);
        if (cancelled) return;
        const map = new Map(remote.map((w) => [w.generationId, w]));
        // Les modifications locales non encore synchronisées priment sur l'état serveur.
        for (const op of queued) {
          if (op.kind === 'wish-put') map.set(op.entry.generationId, op.entry);
          if (op.kind === 'wish-delete') map.delete(op.generationId);
        }
        // Favoris locaux absents du serveur (profil jamais synchronisé) : on les envoie.
        for (const local of readLocal<WishlistEntry[]>(KEYS.wishlist, [])) {
          if (!map.has(local.generationId) && !queued.some((o) => o.kind === 'wish-delete' && o.generationId === local.generationId)) {
            map.set(local.generationId, local);
            enqueue({ kind: 'wish-put', entry: local });
          }
        }
        setWishlist([...map.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
      } catch {
        // Serveur injoignable : on garde la copie locale, la file sera rejouée plus tard.
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, enqueue]);

  // Rejoue la file dès qu'il y a des opérations, et au retour en ligne.
  useEffect(() => {
    if (!pending.length || syncing) return;
    const t = setTimeout(() => flush(pending, profileId), Math.max(300, backoffUntil - Date.now()));
    return () => clearTimeout(t);
  }, [pending, syncing, flush, profileId, backoffUntil]);

  useEffect(() => {
    const onOnline = () => setBackoffUntil(0);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const savePreferences = useCallback((prefs: Preferences, opts?: { completeOnboarding?: boolean }) => {
    requestPersistentStorage();
    setProfile((p) => ({
      ...p,
      preferences: prefs,
      onboardedAt: opts?.completeOnboarding ? p.onboardedAt ?? new Date().toISOString() : p.onboardedAt,
      updatedAt: new Date().toISOString(),
    }));
    enqueue({ kind: 'profile' });
  }, [enqueue]);

  const resetOnboarding = useCallback(() => {
    setProfile((p) => ({ ...p, onboardedAt: null, updatedAt: new Date().toISOString() }));
    enqueue({ kind: 'profile' });
  }, [enqueue]);

  const wishedIds = useMemo(() => new Set(wishlist.map((w) => w.generationId)), [wishlist]);

  const removeWish = useCallback((id: string) => {
    setWishlist((list) => list.filter((w) => w.generationId !== id));
    enqueue({ kind: 'wish-delete', generationId: id });
  }, [enqueue]);

  const toggleWish = useCallback((car: CarSummary) => {
    if (wishedIds.has(car.id)) {
      removeWish(car.id);
      return false;
    }
    requestPersistentStorage();
    const entry: WishlistEntry = { generationId: car.id, addedAt: new Date().toISOString(), snapshot: car };
    setWishlist((list) => [entry, ...list.filter((w) => w.generationId !== car.id)]);
    enqueue({ kind: 'wish-put', entry });
    return true;
  }, [wishedIds, removeWish, enqueue]);

  const exportData = useCallback((): ExportedData => ({
    format: 'autoverse-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences: { ...DEFAULT_PREFERENCES, ...profile.preferences },
    onboardedAt: profile.onboardedAt,
    wishlist,
    collection: readCollection(),
  }), [profile, wishlist]);

  /** Restaure une sauvegarde : remplace préférences et wishlist. Renvoie le nombre de favoris importés. */
  const importData = useCallback((data: unknown): number => {
    const d = data as Partial<ExportedData> | null;
    if (!d || d.format !== 'autoverse-backup' || !d.preferences || !Array.isArray(d.wishlist)) {
      throw new Error('Ce fichier n’est pas une sauvegarde Autoverse.');
    }
    const entries = d.wishlist.filter((w): w is WishlistEntry => !!w && typeof w.generationId === 'string' && !!w.snapshot);
    setProfile((p) => ({ ...p, preferences: { ...DEFAULT_PREFERENCES, ...d.preferences }, onboardedAt: d.onboardedAt ?? p.onboardedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }));
    setWishlist(entries);
    if (d.collection && typeof d.collection === 'object' && d.collection.cards) setCollectionState(d.collection);
    enqueue({ kind: 'profile' });
    entries.forEach((entry) => enqueue({ kind: 'wish-put', entry }));
    return entries.length;
  }, [enqueue]);

  const linkProfile = useCallback(async (id: string) => {
    const remote = await api.get<Profile | null>(`/profile/${id.trim()}`);
    if (!remote) throw new ApiError('Profil inconnu.', 404);
    writeLocal(KEYS.profileId, remote.id);
    writeLocal(KEYS.pending, []);
    writeLocal(KEYS.wishlist, []);
    setPending([]);
    setWishlist([]);
    setProfile(remote);
    setProfileId(remote.id);
  }, []);

  const value: ProfileContextValue = {
    profileId,
    profile,
    preferences: { ...DEFAULT_PREFERENCES, ...profile.preferences },
    isOnboarded: !!profile.onboardedAt,
    savePreferences,
    resetOnboarding,
    wishlist,
    isWished: (id) => wishedIds.has(id),
    toggleWish,
    removeWish,
    syncState: !SERVER_SYNC ? 'local' : syncing ? 'syncing' : pending.length ? 'pending' : 'synced',
    linkProfile,
    exportData,
    importData,
  };
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile doit être utilisé dans <ProfileProvider>');
  return ctx;
}
