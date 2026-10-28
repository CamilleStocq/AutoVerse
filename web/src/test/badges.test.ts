import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Brand, Generation } from '@shared/types';
import { collectibleCards } from '@shared/catalog-engine';
import { computeBadges } from '../lib/badges';
import { addCards, drawBooster, WELCOME_BOOSTERS, type CollectionState } from '../state/collection';

// Vraies cartes du catalogue exporté (web/public/data/catalog.json), si présent.
const file = path.resolve(process.cwd(), 'public', 'data', 'catalog.json');
const catalog = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { brands: Brand[]; generations: Generation[] }) : null;
const cards = catalog
  ? collectibleCards({ brands: new Map(catalog.brands.map((b) => [b.id, b])), generations: new Map(catalog.generations.map((g) => [g.id, g])), imagesFor: () => [] }, 'BE')
  : [];

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Joue un début de partie : on ouvre tous les boosters disponibles, récompenses de badges comprises. */
function playWelcome(seed: number) {
  const rng = seeded(seed);
  let owned: CollectionState['cards'] = {};
  let boosters = WELCOME_BOOSTERS;
  let opened = 0;
  let bonus = 0;
  const rewarded = new Set<string>();
  while (boosters > 0) {
    const drawn = drawBooster(cards, owned, rng);
    owned = addCards({ cards: owned } as CollectionState, drawn.map((c) => c.card?.id ?? c.id)).cards;
    boosters--;
    opened++;
    for (const b of computeBadges(cards, owned, opened)) {
      if (b.unlocked && !rewarded.has(b.id)) { rewarded.add(b.id); boosters += b.reward; bonus += b.reward; }
    }
  }
  return { bonus, opened, owned: Object.keys(owned).length };
}

describe.skipIf(!catalog)('équilibre des récompenses (vraies cartes)', () => {
  it('aucun badge n’est atteint avec les 3 boosters de bienvenue', () => {
    const runs = Array.from({ length: 1000 }, (_, i) => playWelcome(i + 1));
    expect(Math.max(...runs.map((r) => r.bonus))).toBe(0);
    expect(Math.max(...runs.map((r) => r.opened))).toBe(WELCOME_BOOSTERS);
  });
});
