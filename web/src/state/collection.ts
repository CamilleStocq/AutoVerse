/**
 * Collection de cartes (esprit cartes Pokémon) : boosters tirés parmi les marques préférées,
 * albums par marque, doubles échangeables. Tout est enregistré sur l'appareil.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CarSummary, Rarity } from '@shared/api';
import { KEYS, readLocal, requestPersistentStorage, writeLocal } from './storage';

export interface CollectionState {
  cards: Record<string, { count: number; firstAt: string }>;
  boosters: number;
  lastGrantDay: string | null;
  welcomeGiven: boolean;
  opened: number;
}

export const BOOSTER_SIZE = 5;
export const MAX_STORED_BOOSTERS = 3;
export const WELCOME_BOOSTERS = 3;
export const EXCHANGE_COST = 3;

const EMPTY: CollectionState = { cards: {}, boosters: 0, lastGrantDay: null, welcomeGiven: false, opened: 0 };

/** Probabilités par emplacement (la dernière carte du booster est au moins Rare). */
export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 55, rare: 30, epic: 12, legendary: 3 };
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

const dayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Boosters gagnés : 3 à la première ouverture, puis 1 par jour (cumulables jusqu'à 3). */
export function grantBoosters(s: CollectionState, now = new Date()): CollectionState {
  const today = dayOf(now);
  if (!s.welcomeGiven) return { ...s, boosters: s.boosters + WELCOME_BOOSTERS, welcomeGiven: true, lastGrantDay: today };
  if (s.lastGrantDay === today) return s;
  const last = s.lastGrantDay ? new Date(`${s.lastGrantDay}T00:00:00`) : now;
  const days = Math.max(1, Math.round((new Date(`${today}T00:00:00`).getTime() - last.getTime()) / 86_400_000));
  return { ...s, boosters: Math.min(MAX_STORED_BOOSTERS, s.boosters + days), lastGrantDay: today };
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
 * Tire un booster dans le paquet (marques préférées). Une carte pas encore possédée a deux fois
 * plus de chances de sortir ; si aucune carte n'existe à la rareté tirée, on prend la plus proche.
 */
export function drawBooster(pool: CarSummary[], owned: CollectionState['cards'], rng: () => number = Math.random): CarSummary[] {
  if (!pool.length) return [];
  const byRarity = new Map<Rarity, CarSummary[]>();
  for (const c of pool) {
    const r = c.card?.rarity ?? 'common';
    byRarity.set(r, [...(byRarity.get(r) ?? []), c]);
  }
  const nearest = (r: Rarity) => {
    const i = RARITY_ORDER.indexOf(r);
    const order = [i, i - 1, i + 1, i - 2, i + 2, i - 3, i + 3].filter((k) => k >= 0 && k < RARITY_ORDER.length);
    for (const k of order) if (byRarity.get(RARITY_ORDER[k])?.length) return byRarity.get(RARITY_ORDER[k])!;
    return pool;
  };
  const drawn: CarSummary[] = [];
  for (let slot = 0; slot < BOOSTER_SIZE; slot++) {
    const rarity = pickRarity(rng, slot === BOOSTER_SIZE - 1 ? 'rare' : 'common');
    const candidates = nearest(rarity).filter((c) => !drawn.includes(c) || pool.length <= BOOSTER_SIZE);
    const list = candidates.length ? candidates : nearest(rarity);
    const weights = list.map((c) => (owned[c.id] ? 1 : 2));
    let x = rng() * weights.reduce((a, b) => a + b, 0);
    let pick = list[list.length - 1];
    for (let i = 0; i < list.length; i++) {
      x -= weights[i];
      if (x <= 0) { pick = list[i]; break; }
    }
    drawn.push(pick);
  }
  return drawn;
}

export function addCards(s: CollectionState, cars: CarSummary[], now = new Date().toISOString()): CollectionState {
  const cards = { ...s.cards };
  for (const c of cars) cards[c.id] = { count: (cards[c.id]?.count ?? 0) + 1, firstAt: cards[c.id]?.firstAt ?? now };
  return { ...s, cards };
}

export const doublesCount = (s: CollectionState) => Object.values(s.cards).reduce((n, c) => n + Math.max(0, c.count - 1), 0);

/** Échange 3 doubles (les plus nombreux d'abord) contre une carte manquante choisie. */
export function exchangeDoubles(s: CollectionState, target: CarSummary): CollectionState | null {
  if (s.cards[target.id] || doublesCount(s) < EXCHANGE_COST) return null;
  const cards = { ...s.cards };
  let toPay = EXCHANGE_COST;
  while (toPay > 0) {
    const [id] = Object.entries(cards).filter(([, c]) => c.count > 1).sort((a, b) => b[1].count - a[1].count)[0];
    cards[id] = { ...cards[id], count: cards[id].count - 1 };
    toPay--;
  }
  cards[target.id] = { count: 1, firstAt: new Date().toISOString() };
  return { ...s, cards };
}

// ---------- Hook ----------

const listeners = new Set<(s: CollectionState) => void>();

function load(): CollectionState {
  return { ...EMPTY, ...readLocal<Partial<CollectionState>>(KEYS.collection, {}) };
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
    // Nouveau jour pendant que l'app est ouverte (ou au retour au premier plan).
    const onVisible = () => { if (document.visibilityState === 'visible') save(grantBoosters(load())); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      listeners.delete(setState);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  /** Ouvre un booster : renvoie les cartes tirées (et marque les nouvelles). */
  const openBooster = useCallback((pool: CarSummary[]) => {
    const current = load();
    if (current.boosters < 1 || !pool.length) return null;
    const drawn = drawBooster(pool, current.cards);
    const isNew = drawn.map((c, i) => !current.cards[c.id] && drawn.findIndex((d) => d.id === c.id) === i);
    requestPersistentStorage();
    save({ ...addCards(current, drawn), boosters: current.boosters - 1, opened: current.opened + 1 });
    return drawn.map((car, i) => ({ car, isNew: isNew[i] }));
  }, []);

  const exchange = useCallback((target: CarSummary) => {
    const next = exchangeDoubles(load(), target);
    if (next) save(next);
    return !!next;
  }, []);

  return { state, owned: state.cards, doubles: doublesCount(state), openBooster, exchange };
}

export function readCollection(): CollectionState {
  return load();
}

/** Remplace la collection (restauration d'une sauvegarde). */
export function setCollectionState(next: CollectionState): void {
  save({ ...EMPTY, ...next });
}
