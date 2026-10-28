import { describe, expect, it } from 'vitest';
import type { CarSummary, Rarity } from '@shared/api';
import {
  addCards, BOOSTER_INTERVAL_MS, BOOSTER_SIZE, drawBooster, grantBoosters, MAX_BONUS_PER_INTERVAL,
  MAX_STORED_BOOSTERS, migrateCardIds, nextBoosterIn, quizAllowance, QUIZ_PER_HOUR, WELCOME_BOOSTERS, type CollectionState,
} from '../state/collection';

const empty: CollectionState = { cards: {}, boosters: 0, lastGrantAt: null, welcomeGiven: false, opened: 0, pending: null, quizzes: [], bonuses: [], badges: [], rewarded: [] };
const car = (id: string, rarity: Rarity, brandId = 'porsche') => ({ id, brandId, card: { rarity } }) as unknown as CarSummary;
const at = (iso: string) => new Date(iso);

/** Générateur pseudo-aléatoire reproductible. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('boosters gratuits', () => {
  it('3 de bienvenue, puis 1 toutes les 2 heures, réserve de 3', () => {
    const t0 = at('2026-10-28T10:00:00Z');
    const s0 = grantBoosters(empty, t0);
    expect(s0.boosters).toBe(WELCOME_BOOSTERS);
    const emptied = { ...s0, boosters: 0 };
    expect(grantBoosters(emptied, at('2026-10-28T11:59:00Z')).boosters).toBe(0); // 1 h 59 : pas encore
    const after2h = grantBoosters(emptied, at('2026-10-28T12:00:00Z'));
    expect(after2h.boosters).toBe(1);
    expect(nextBoosterIn(after2h, Date.parse('2026-10-28T12:00:00Z'))).toBe(BOOSTER_INTERVAL_MS);
    expect(grantBoosters(emptied, at('2026-10-30T10:00:00Z')).boosters).toBe(MAX_STORED_BOOSTERS);
  });

  it('réserve pleine : pas de compteur', () => {
    expect(nextBoosterIn({ ...empty, boosters: MAX_STORED_BOOSTERS, lastGrantAt: '2026-10-28T10:00:00Z' })).toBeNull();
  });
});

describe('questionnaires', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  const ago = (min: number) => new Date(now - min * 60000).toISOString();

  it('3 questionnaires par heure glissante', () => {
    const s = { ...empty, quizzes: [ago(10), ago(20), ago(50)] };
    expect(quizAllowance(s, now).attemptsLeft).toBe(0);
    expect(quizAllowance(s, now).left).toBe(0);
    expect(Math.round(quizAllowance(s, now).waitMs / 60000)).toBe(10);
    expect(quizAllowance({ ...empty, quizzes: [ago(70)] }, now).attemptsLeft).toBe(QUIZ_PER_HOUR);
  });

  it('au plus 2 boosters bonus par période de 2 heures', () => {
    const capped = { ...empty, bonuses: [ago(30), ago(100)] };
    expect(quizAllowance(capped, now).bonusLeft).toBe(0);
    expect(quizAllowance(capped, now).left).toBe(0); // inutile de jouer : aucun bonus possible
    expect(Math.round(quizAllowance(capped, now).waitMs / 60000)).toBe(20);
    expect(quizAllowance({ ...empty, bonuses: [ago(130)] }, now).bonusLeft).toBe(MAX_BONUS_PER_INTERVAL);
  });
});

describe('tirage', () => {
  const pool = Array.from({ length: 20 }, (_, i) => car(`c${i}`, (['common', 'common', 'rare', 'epic', 'legendary'] as Rarity[])[i % 5]));

  it('7 cartes toutes différentes, au moins une Rare, jamais une carte déjà possédée', () => {
    const owned = { c0: { count: 1, firstAt: '' }, c2: { count: 1, firstAt: '' } };
    for (let s = 1; s < 60; s++) {
      const drawn = drawBooster(pool, owned, seeded(s));
      expect(drawn).toHaveLength(BOOSTER_SIZE);
      expect(new Set(drawn).size).toBe(BOOSTER_SIZE);
      expect(drawn.some((c) => c.id === 'c0' || c.id === 'c2')).toBe(false);
      expect(drawn.some((c) => c.card!.rarity !== 'common')).toBe(true);
    }
  });

  it('moins de cartes restantes que la taille du booster : booster plus petit, sans double', () => {
    expect(drawBooster([car('a', 'common'), car('b', 'common')], {}, seeded(7))).toHaveLength(2);
  });

  it('marques préférées complètes : on pioche dans tout le catalogue', () => {
    const fav = [car('f1', 'common')];
    const drawn = drawBooster(fav, { f1: { count: 1, firstAt: '' } }, seeded(3), pool);
    expect(drawn).toHaveLength(BOOSTER_SIZE);
    expect(drawn.every((c) => pool.includes(c))).toBe(true);
  });

  it('tout est possédé : booster vide', () => {
    const all = Object.fromEntries(pool.map((c) => [c.id, { count: 1, firstAt: '' }]));
    expect(drawBooster(pool, all, seeded(1), pool)).toHaveLength(0);
  });

  it('une carte reçue compte toujours pour 1', () => {
    expect(addCards(empty, ['a', 'a', 'b']).cards.a.count).toBe(1);
  });
});

describe('cartes par version', () => {
  it("convertit l'ancien deck (une carte par fiche) sans rien perdre", () => {
    const old: CollectionState = { ...empty, cards: { '911-992': { count: 2, firstAt: '2026-01-02' }, 'gt3-rs': { count: 1, firstAt: '2026-01-01' }, 'sans-version': { count: 1, firstAt: '2026-01-03' } }, pending: ['911-992'] };
    const s = migrateCardIds(old, { '911-992': 'gt3-rs', 'sans-version': 'sans-version' });
    expect(s.cards).toEqual({ 'gt3-rs': { count: 3, firstAt: '2026-01-01' }, 'sans-version': { count: 1, firstAt: '2026-01-03' } });
    expect(s.pending).toEqual(['gt3-rs']);
    // Déjà converti : rien ne change.
    expect(migrateCardIds(s, { '911-992': 'gt3-rs' })).toBe(s);
  });
});
