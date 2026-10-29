import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Brand, Generation } from '@shared/types';
import { collectibleCards } from '@shared/catalog-engine';
import { buildQuiz, QUIZ_LENGTH } from '../lib/quiz';

// Données réelles exportées (web/public/data, produites par l'export statique), si présentes.
const dir = path.resolve(process.cwd(), 'public', 'data');
const load = (name: string) => {
  const p = path.join(dir, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).data : null;
};
const catalogFile = path.join(dir, 'catalog.json');
const catalog = existsSync(catalogFile) ? (JSON.parse(readFileSync(catalogFile, 'utf8')) as { brands: Brand[]; generations: Generation[] }) : null;
const cards = catalog
  ? collectibleCards({ brands: new Map(catalog.brands.map((b) => [b.id, b])), generations: new Map(catalog.generations.map((g) => [g.id, g])), imagesFor: () => [] }, 'BE')
  : [];
const data = { f1: load('f1.json'), wec: load('wec.json'), wrc: load('wrc.json'), cards };

describe.each(['f1', 'wec', 'wrc'] as const)('questionnaire %s', (discipline) => {
  it.skipIf(!data[discipline])('5 questions distinctes, 4 choix, la bonne réponse parmi eux', () => {
    for (let seed = 1; seed < 20; seed++) {
      let s = seed;
      const rng = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      const quiz = buildQuiz(discipline, data, rng);
      expect(quiz).not.toBeNull();
      expect(quiz).toHaveLength(QUIZ_LENGTH);
      expect(new Set(quiz!.map((q) => q.prompt)).size).toBe(QUIZ_LENGTH);
      for (const q of quiz!) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(q.answer);
        // La question ne contient jamais sa propre réponse.
        // (mot entier : la réponse « 0 » n'est pas « contenue » dans « 2026 »).
        const escaped = q.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const word = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu');
        expect(word.test(q.prompt)).toBe(false);
      }
      // Les thèmes sont mélangés : jamais 5 questions du même type.
      expect(new Set(quiz!.map((q) => q.theme)).size).toBeGreaterThanOrEqual(2);
    }
  });
});

it('pas de questionnaire sans données', () => {
  expect(buildQuiz('f1', {})).toBeNull();
});
