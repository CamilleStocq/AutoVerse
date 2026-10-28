import { describe, expect, it } from 'vitest';
import type { CarSummary, Rarity } from '@shared/api';
import {
  addCards, BOOSTER_INTERVAL_MS, BOOSTER_SIZE, doublesCount, drawBooster, grantBoosters, MAX_BONUS_PER_INTERVAL,
  MAX_STORED_BOOSTERS, migrateCardIds, nextBoosterIn, quizAllowance, QUIZ_PER_HOUR, WELCOME_BOOSTERS, type CollectionState,
} from '../state/collection';

const empty: CollectionState = { cards: {}, boosters: 0, lastGrantAt: null, welcomeGiven: false, opened: 0, pending: null, quizzes: [], bonuses: [] };
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
  it('3 de bienvenue, puis 1 toutes les 3 heures, réserve de 3', () => {
    const t0 = at('2026-10-28T10:00:00Z');
    const s0 = grantBoosters(empty, t0);
    expect(s0.boosters).toBe(WELCOME_BOOSTERS);
    const emptied = { ...s0, boosters: 0 };
    expect(grantBoosters(emptied, at('2026-10-28T12:59:00Z')).boosters).toBe(0); // 2 h 59 : pas encore
    const after3h = grantBoosters(emptied, at('2026-10-28T13:00:00Z'));
    expect(after3h.boosters).toBe(1);
    expect(nextBoosterIn(after3h, Date.parse('2026-10-28T13:00:00Z'))).toBe(BOOSTER_INTERVAL_MS);
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

  it('au plus 2 boosters bonus par période de 3 heures', () => {
    const capped = { ...empty, bonuses: [ago(30), ago(100)] };
    expect(quizAllowance(capped, now).bonusLeft).toBe(0);
    expect(quizAllowance(capped, now).left).toBe(0); // inutile de jouer : aucun bonus possible
    expect(Math.round(quizAllowance(capped, now).waitMs / 60000)).toBe(80);
    expect(quizAllowance({ ...empty, bonuses: [ago(200)] }, now).bonusLeft).toBe(MAX_BONUS_PER_INTERVAL);
  });
});

describe('tirage', () => {
  it('5 cartes tirées dans le seul paquet fourni, au moins une Rare', () => {
    const pool = [car('c1', 'common'), car('c2', 'common'), car('c3', 'common'), car('r1', 'rare'), car('e1', 'epic'), car('l1', 'legendary')];
    for (let s = 1; s < 60; s++) {
      const drawn = drawBooster(pool, {}, seeded(s));
      expect(drawn).toHaveLength(BOOSTER_SIZE);
      expect(drawn.every((c) => pool.includes(c))).toBe(true);
      expect(drawn.some((c) => c.card!.rarity !== 'common')).toBe(true);
    }
  });

  it('paquet sans carte de la rareté tirée : on prend la rareté la plus proche', () => {
    expect(drawBooster([car('c1', 'common'), car('c2', 'common')], {}, seeded(7))).toHaveLength(BOOSTER_SIZE);
  });

  it('les doubles sont comptés', () => {
    const s = addCards(empty, ['a', 'a', 'a', 'b']);
    expect(s.cards.a.count).toBe(3);
    expect(doublesCount(s)).toBe(2);
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
