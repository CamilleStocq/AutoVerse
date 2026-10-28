import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparePartialDates, formatPartialDate, isWithinWindow, releaseWindow } from '../../shared/dates.ts';

const NOW = new Date('2026-10-28T10:00:00Z');

test('une date partielle n’est jamais affichée avec plus de précision que la source', () => {
  assert.equal(formatPartialDate({ year: 2027 }), '2027');
  assert.equal(formatPartialDate({ year: 2027, half: 'early' }), 'début 2027');
  assert.equal(formatPartialDate({ year: 2027, quarter: 2 }), '2e trimestre 2027');
  assert.equal(formatPartialDate({ year: 2027, quarter: 1 }), '1er trimestre 2027');
  assert.equal(formatPartialDate({ year: 2027, month: 3 }), 'mars 2027');
  assert.equal(formatPartialDate({ year: 2027, month: 3, day: 12 }), '12 mars 2027');
  assert.equal(formatPartialDate(null), 'Date inconnue');
});

test('une sortie annoncée seulement à l’année n’entre pas dans « 3 mois »', () => {
  assert.equal(releaseWindow({ year: 2027 }, NOW), 'later');
  assert.equal(releaseWindow({ year: 2026, month: 11, day: 15 }, NOW), 'soon');
  assert.equal(releaseWindow({ year: 2026, month: 11 }, NOW), '3m', 'novembre entier ne tient pas dans 30 jours');
  assert.equal(releaseWindow({ year: 2026, month: 12 }, NOW), '3m');
  assert.equal(releaseWindow({ year: 2027, month: 1 }, NOW), '6m', 'fin janvier dépasse l’horizon de 3 mois');
  assert.equal(releaseWindow({ year: 2027, quarter: 2 }, NOW), '12m');
  assert.equal(releaseWindow({ year: 2025 }, NOW), 'past');
  assert.equal(releaseWindow(null, NOW), 'unknown');
});

test('les fenêtres sont cumulatives, la date inconnue est exclusive', () => {
  assert.ok(isWithinWindow('soon', '6m'));
  assert.ok(isWithinWindow('3m', '3m'));
  assert.ok(!isWithinWindow('12m', '6m'));
  assert.ok(!isWithinWindow('unknown', '12m'));
  assert.ok(isWithinWindow('unknown', 'unknown'));
});

test('tri chronologique : dates inconnues en dernier', () => {
  const list = [null, { year: 2027 }, { year: 2026, month: 12 }];
  list.sort(comparePartialDates);
  assert.deepEqual(list, [{ year: 2026, month: 12 }, { year: 2027 }, null]);
});
