import { describe, expect, it } from 'vitest';
import type { CarSummary, Rarity } from '@shared/api';
import { addCards, BOOSTER_SIZE, doublesCount, drawBooster, exchangeDoubles, grantBoosters, MAX_STORED_BOOSTERS, WELCOME_BOOSTERS, type CollectionState } from '../state/collection';

const empty: CollectionState = { cards: {}, boosters: 0, lastGrantDay: null, welcomeGiven: false, opened: 0 };
const car = (id: string, rarity: Rarity, brandId = 'porsche') => ({ id, brandId, card: { rarity } }) as unknown as CarSummary;

/** Générateur pseudo-aléatoire reproductible. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('boosters', () => {
  it('3 boosters de bienvenue, puis 1 par jour, cumulables jusqu’à 3', () => {
    const day1 = grantBoosters(empty, new Date('2026-10-28T10:00:00'));
    expect(day1.boosters).toBe(WELCOME_BOOSTERS);
    expect(grantBoosters(day1, new Date('2026-10-28T20:00:00'))).toBe(day1); // même jour : rien de plus
    const opened = { ...day1, boosters: 0 };
    expect(grantBoosters(opened, new Date('2026-10-29T08:00:00')).boosters).toBe(1);
    expect(grantBoosters(opened, new Date('2026-11-15T08:00:00')).boosters).toBe(MAX_STORED_BOOSTERS);
  });

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
    const drawn = drawBooster([car('c1', 'common'), car('c2', 'common')], {}, seeded(7));
    expect(drawn).toHaveLength(BOOSTER_SIZE);
  });
});

describe('collection', () => {
  it('compte les doubles et échange 3 doubles contre une carte manquante', () => {
    let s = addCards(empty, [car('a', 'common'), car('a', 'common'), car('a', 'common'), car('b', 'rare'), car('b', 'rare')]);
    expect(doublesCount(s)).toBe(3);
    expect(exchangeDoubles(s, car('b', 'rare'))).toBeNull(); // déjà possédée
    s = exchangeDoubles(s, car('z', 'legendary'))!;
    expect(s.cards.z.count).toBe(1);
    expect(doublesCount(s)).toBe(0);
    expect(s.cards.a.count).toBe(1);
    expect(exchangeDoubles(s, car('y', 'epic'))).toBeNull(); // plus assez de doubles
  });
});
