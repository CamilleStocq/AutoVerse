/**
 * Deck de cartes (esprit cartes Pokémon). Une carte n'entre dans le deck que si elle sort d'un booster.
 * - Boosters de 7 cartes : 3 de bienvenue, puis 1 toutes les 2 heures (jusqu'à 3 en réserve).
 * - Jamais de double : un booster ne contient que des cartes pas encore possédées.
 * - Boosters bonus : questionnaire F1 / WEC / WRC parfait (5/5) ; au plus 2 bonus par période
 *   de 2 heures, et au plus 3 questionnaires par heure.
 * - Un booster ouvert reste « en attente » jusqu'au bouton « Ajouter au deck » : fermer l'app
 *   pendant l'ouverture ne fait rien perdre (l'ouverture reprend au retour).
 * Tout est enregistré sur l'appareil.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CarSummary, Rarity } from '@shared/api';
import { KEYS, readLocal, requestPersistentStorage, writeLocal } from './storage';

export interface CollectionState {
  cards: Record<string, { count: number; firstAt: string }>;
  boosters: number;
  /** Instant de référence du prochain booster gratuit (ISO). */
  lastGrantAt: string | null;
  welcomeGiven: boolean;
  opened: number;
  /** Booster ouvert dont les cartes n'ont pas encore été ajoutées au deck (identifiants). */
  pending: string[] | null;
  /** Débuts de questionnaires (ISO), pour la limite horaire. */
  quizzes: string[];
  /** Boosters bonus gagnés (ISO), pour la limite de 2 par période de 2 h. */
  bonuses: string[];
  /** Badges déjà annoncés (pour ne féliciter qu'une fois). */
  badges: string[];
}

export const BOOSTER_SIZE = 7;
export const MAX_STORED_BOOSTERS = 3;
export const WELCOME_BOOSTERS = 3;
export const BOOSTER_INTERVAL_MS = 2 * 3600 * 1000;
/** Durée entre deux boosters gratuits, en heures (pour les textes). */
export const BOOSTER_INTERVAL_HOURS = BOOSTER_INTERVAL_MS / 3600_000;
export const QUIZ_PER_HOUR = 3;
export const MAX_BONUS_PER_INTERVAL = 2;
const HOUR = 3600 * 1000;

const EMPTY: CollectionState = { cards: {}, boosters: 0, lastGrantAt: null, welcomeGiven: false, opened: 0, pending: null, quizzes: [], bonuses: [], badges: [] };

/** Probabilités par emplacement (la dernière carte du booster est au moins Rare). */
export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 55, rare: 30, epic: 12, legendary: 3 };
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Boosters gagnés avec le temps : 3 à la première ouverture, puis 1 toutes les 2 h (réserve de 3). */
export function grantBoosters(s: CollectionState, now = new Date()): CollectionState {
  const t = now.getTime();
  if (!s.welcomeGiven) return { ...s, boosters: s.boosters + WELCOME_BOOSTERS, welcomeGiven: true, lastGrantAt: now.toISOString() };
  const last = s.lastGrantAt ? Date.parse(s.lastGrantAt) : t;
  const earned = Math.floor((t - last) / BOOSTER_INTERVAL_MS);
  if (earned < 1) return s.lastGrantAt ? s : { ...s, lastGrantAt: now.toISOString() };
  const room = Math.max(0, MAX_STORED_BOOSTERS - s.boosters);
  const added = Math.min(room, earned);
  // Réserve pleine : le compteur repart de maintenant (pas de boosters « en stock invisible »).
  const lastGrantAt = added < earned ? now.toISOString() : new Date(last + earned * BOOSTER_INTERVAL_MS).toISOString();
  return { ...s, boosters: s.boosters + added, lastGrantAt };
}

/** Millisecondes avant le prochain booster gratuit (null si la réserve est pleine). */
export function nextBoosterIn(s: CollectionState, now = Date.now()): number | null {
  if (s.boosters >= MAX_STORED_BOOSTERS || !s.lastGrantAt) return null;
  return Math.max(0, Date.parse(s.lastGrantAt) + BOOSTER_INTERVAL_MS - now);
}

/**
 * Questionnaire possible ? Il faut à la fois une tentative disponible (3 par heure glissante)
 * et un booster bonus encore gagnable (2 par période glissante de 2 h).
 */
export function quizAllowance(s: CollectionState, now = Date.now()) {
  const recent = s.quizzes.filter((q) => now - Date.parse(q) < HOUR).sort();
  const attemptsLeft = Math.max(0, QUIZ_PER_HOUR - recent.length);
  const bonuses = s.bonuses.filter((b) => now - Date.parse(b) < BOOSTER_INTERVAL_MS).sort();
  const bonusLeft = Math.max(0, MAX_BONUS_PER_INTERVAL - bonuses.length);
  const attemptWait = attemptsLeft > 0 ? 0 : Date.parse(recent[0]) + HOUR - now;
  const bonusWait = bonusLeft > 0 ? 0 : Date.parse(bonuses[0]) + BOOSTER_INTERVAL_MS - now;
  return { left: bonusLeft > 0 ? attemptsLeft : 0, attemptsLeft, bonusLeft, waitMs: Math.max(attemptWait, bonusWait) };
}

function pickRarity(rng: () => number, minimum: Rarity = 'common'): Rarity {
  const allowed = RARITY_ORDER.slice(RARITY_ORDER.indexOf(minimum));
  const total = allowed.reduce((n, r) => n + RARITY_WEIGHTS[r], 0);
  let x = rng() * total;
  for (const r of allowed) {
    x -= RARITY_WEIGHTS[r];
    if (x <= 0) return r;
  }
  return allowed[allowed.length - 1];
}

/**
 * Tire un booster : uniquement des cartes pas encore possédées, toutes différentes (jamais de double).
 * Le paquet est d'abord celui des marques préférées, puis tout le catalogue quand elles sont complètes.
 * La dernière carte est au moins Rare quand il en reste ; si aucune carte n'existe à la rareté tirée,
 * on prend la plus proche. Quand il reste moins de cartes que la taille d'un booster, il est plus petit.
 */
export function drawBooster(pool: CarSummary[], owned: CollectionState['cards'], rng: () => number = Math.random, fallback: CarSummary[] = []): CarSummary[] {
  const fresh = (list: CarSummary[]) => list.filter((c) => !owned[cardKey(c)]);
  let left = fresh(pool);
  if (!left.length) left = fresh(fallback);
  const drawn: CarSummary[] = [];
  const size = Math.min(BOOSTER_SIZE, left.length);
  for (let slot = 0; slot < size; slot++) {
    const byRarity = new Map<Rarity, CarSummary[]>();
    for (const c of left) {
      const r = c.card?.rarity ?? 'common';
      byRarity.set(r, [...(byRarity.get(r) ?? []), c]);
    }
    const rarity = pickRarity(rng, slot === size - 1 && [...byRarity.keys()].some((r) => r !== 'common') ? 'rare' : 'common');
    const i = RARITY_ORDER.indexOf(rarity);
    const order = [i, i - 1, i + 1, i - 2, i + 2, i - 3, i + 3].filter((k) => k >= 0 && k < RARITY_ORDER.length);
    const list = order.map((k) => byRarity.get(RARITY_ORDER[k])).find((l) => l?.length) ?? left;
    const pick = list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    drawn.push(pick);
    left = left.filter((c) => c !== pick);
  }
  return drawn;
}

export function addCards(s: CollectionState, ids: string[], now = new Date().toISOString()): CollectionState {
  const cards = { ...s.cards };
  for (const id of ids) cards[id] = { count: 1, firstAt: cards[id]?.firstAt ?? now };
  return { ...s, cards };
}

/** Identifiant de collection d'une carte : sa version (ou la fiche quand aucune version n'est publiée). */
export const cardKey = (c: CarSummary) => c.card?.id ?? c.id;

/**
 * Ancien format (une carte par fiche) : chaque carte devient celle de la version « vitrine »
 * de sa fiche, la plus puissante. Rien n'est perdu (doubles compris).
 */
export function migrateCardIds(s: CollectionState, legacy: Record<string, string>): CollectionState {
  const move = (id: string) => legacy[id] ?? id;
  const ids = Object.keys(s.cards);
  if (!ids.some((id) => legacy[id] && legacy[id] !== id) && !s.pending?.some((id) => legacy[id] && legacy[id] !== id)) return s;
  const cards: CollectionState['cards'] = {};
  for (const id of ids) {
    const to = move(id);
    const prev = cards[to];
    const cur = s.cards[id];
    cards[to] = prev ? { count: prev.count + cur.count, firstAt: prev.firstAt < cur.firstAt ? prev.firstAt : cur.firstAt } : cur;
  }
  return { ...s, cards, pending: s.pending?.map(move) ?? null };
}

/** Applique la migration ci-dessus sur la collection enregistrée (une seule fois, sans effet ensuite). */
export function applyCardMigration(legacy: Record<string, string>): void {
  const current = load();
  const next = migrateCardIds(current, legacy);
  if (next !== current) save(next);
}


// ---------- Hook ----------

const listeners = new Set<(s: CollectionState) => void>();

function load(): CollectionState {
  const raw = readLocal<Partial<CollectionState> & { lastGrantDay?: string }>(KEYS.collection, {});
  // Ancien format (1 booster par jour) : le compteur démarre maintenant.
  const { lastGrantDay: _legacy, ...rest } = raw;
  // Plus de doubles : une carte possédée compte toujours pour 1.
  const cards = Object.fromEntries(Object.entries(rest.cards ?? {}).map(([id, c]) => [id, { ...c, count: 1 }]));
  return { ...EMPTY, ...rest, cards, quizzes: rest.quizzes ?? [], bonuses: rest.bonuses ?? [], badges: rest.badges ?? [], pending: rest.pending ?? null };
}

function save(next: CollectionState) {
  writeLocal(KEYS.collection, next);
  listeners.forEach((l) => l(next));
}

export function useCollection() {
  const [state, setState] = useState<CollectionState>(() => {
    const granted = grantBoosters(load());
    writeLocal(KEYS.collection, granted);
    return granted;
  });

  useEffect(() => {
    listeners.add(setState);
    const refresh = () => {
      const current = load();
      const granted = grantBoosters(current);
      if (granted !== current) save(granted);
    };
    // Vérifie régulièrement (et au retour au premier plan) si un booster est arrivé.
    const timer = setInterval(refresh, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(setState);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  /** Ouvre un booster : le tirage est mis en attente jusqu'à « Ajouter au deck ». */
  const openBooster = useCallback((pool: CarSummary[], fallback: CarSummary[] = []) => {
    const current = load();
    if (current.pending) return current.pending;
    if (current.boosters < 1 || !pool.length) return null;
    const ids = drawBooster(pool, current.cards, Math.random, fallback).map(cardKey);
    if (!ids.length) return null;
    requestPersistentStorage();
    save({ ...current, boosters: current.boosters - 1, opened: current.opened + 1, pending: ids });
    return ids;
  }, []);

  /** « Ajouter au deck » : les cartes du booster en attente rejoignent la collection. */
  const commitPending = useCallback(() => {
    const current = load();
    if (!current.pending) return;
    save({ ...addCards(current, current.pending), pending: null });
  }, []);

  /** Démarre un questionnaire (compté dès le début). Renvoie false si la limite horaire est atteinte. */
  const startQuiz = useCallback(() => {
    const current = load();
    if (quizAllowance(current).left < 1) return false;
    const now = Date.now();
    save({ ...current, quizzes: [...current.quizzes.filter((q) => now - Date.parse(q) < HOUR), new Date(now).toISOString()] });
    return true;
  }, []);

  /** Questionnaire parfait : un booster bonus, dans la limite de 2 par période de 2 h. */
  const rewardQuiz = useCallback(() => {
    const current = load();
    if (quizAllowance(current).bonusLeft < 1) return false;
    const now = Date.now();
    save({ ...current, boosters: current.boosters + 1, bonuses: [...current.bonuses.filter((b) => now - Date.parse(b) < BOOSTER_INTERVAL_MS), new Date(now).toISOString()] });
    return true;
  }, []);

  /** Enregistre les badges annoncés ; renvoie ceux qui étaient nouveaux. */
  const markBadges = useCallback((ids: string[]) => {
    const current = load();
    const fresh = ids.filter((id) => !current.badges.includes(id));
    if (fresh.length) save({ ...current, badges: [...current.badges, ...fresh] });
    return fresh;
  }, []);

  return { state, owned: state.cards, markBadges, openBooster, commitPending, startQuiz, rewardQuiz };
}

export function readCollection(): CollectionState {
  return load();
}

/** Remplace la collection (restauration d'une sauvegarde). */
export function setCollectionState(next: CollectionState): void {
  save({ ...EMPTY, ...next });
}
