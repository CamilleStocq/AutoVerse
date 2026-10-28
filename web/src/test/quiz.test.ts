import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { buildQuiz, QUIZ_LENGTH } from '../lib/quiz';

// Données réelles exportées (web/public/data, produites par l'export statique), si présentes.
const dir = path.resolve(process.cwd(), 'public', 'data');
const load = (name: string) => {
  const p = path.join(dir, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).data : null;
};
const data = { f1: load('f1.json'), wec: load('wec.json'), wrc: load('wrc.json') };

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
      }
    }
  });
});

it('pas de questionnaire sans données', () => {
  expect(buildQuiz('f1', {})).toBeNull();
});
