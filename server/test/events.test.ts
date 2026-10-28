import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Generation } from '../../shared/types.ts';
import type { F1Overview, WecSeason } from '../../shared/sport.ts';
import { f1Events, mergeEvents, releaseEvents, wecEvents } from '../src/events.ts';
import { generation } from './fixtures.ts';

const NOW = '2026-10-28T10:00:00Z';
const brands = [{ id: 'porsche', name: 'Porsche', country: 'Allemagne', founded: 1931, accent: '#000' }];

const upcoming = (over: Record<string, unknown> = {}) => generation('porsche-718-ev', {
  modelName: '718 électrique',
  status: 'announced',
  upcoming: { confirmation: 'official-announcement', confirmed: [], unknown: [], expectedPowertrains: ['ev'], priceStatus: 'not-announced' },
  launch: { presentation: { date: { year: 2027 } } },
  ...over,
}) as unknown as Generation;

test('nouvelle date de sortie et date modifiée détectées, sans doublon si rien ne change', () => {
  const before = [upcoming()];
  const after = [upcoming({ launch: { presentation: { date: { year: 2027, quarter: 2 } }, firstDeliveries: { date: { year: 2028 } } } })];
  const events = releaseEvents(before, after, brands, NOW);
  assert.deepEqual(events.map((e) => e.title), [
    'Porsche 718 électrique : présentation 2e trimestre 2027',
    'Porsche 718 électrique : premières livraisons 2028',
  ]);
  assert.equal(events[0].body, 'Date modifiée (auparavant : 2027).');
  assert.equal(events[0].url, 'voiture/porsche-718-ev');
  assert.deepEqual(releaseEvents(after, after, brands, NOW), []);
});

test('nouveau modèle annoncé et report de date signalés ; rien à la toute première publication', () => {
  assert.equal(releaseEvents([], [upcoming()], brands, NOW)[0].id, 'release-new-porsche-718-ev');
  const delayed = upcoming({ upcoming: { confirmation: 'delayed', confirmed: [], unknown: [], expectedPowertrains: null, priceStatus: 'not-announced' } });
  assert.ok(releaseEvents([upcoming()], [delayed], brands, NOW).some((e) => e.title.endsWith('date reportée')));
  assert.deepEqual(releaseEvents(null, [upcoming()], brands, NOW), []);
});

const race = (round: number) => ({ season: 2026, round, name: `GP ${round}`, circuit: '', locality: '', country: '', dateUtc: '', hasTime: true, sessions: [], hasSprint: false, status: 'completed' as const, wikipedia: null });
const overview = (round: number) => ({
  season: 2026, schedule: [], nextRace: null, drivers: null, constructors: null,
  lastRace: { race: race(round), results: [1, 2, 3].map((p) => ({ position: p, positionText: String(p), driver: { id: `d${p}`, code: null, name: `Pilote ${p}`, number: null, nationality: '' }, team: { id: 't', name: 'Écurie' }, grid: p, laps: 50, status: 'Finished', time: null, points: 25 })) },
}) as F1Overview;

test('résultats F1 : une alerte par nouvelle course classée', () => {
  const e = f1Events(overview(18), overview(19), NOW);
  assert.equal(e.length, 1);
  assert.equal(e[0].id, 'f1-2026-19-race');
  assert.match(e[0].body, /^1\. Pilote 1 \(Écurie\)/);
  assert.deepEqual(f1Events(overview(19), overview(19), NOW), []);
});

test('podiums WEC : uniquement les épreuves nouvellement classées', () => {
  const ev = (results: unknown) => ({ round: 8, shortName: 'Monza', name: '6 Heures de Monza', results }) as WecSeason['events'][number];
  const season = (results: unknown) => ({ season: 2026, classes: [{ id: 'hypercar', name: 'Hypercar', description: '' }], events: [ev(results)] }) as unknown as WecSeason;
  const podium = [{ classId: 'hypercar', podium: [{ position: 1, carNumber: '8', team: 'Toyota Racing', manufacturer: null, car: null, drivers: [] }] }];
  const e = wecEvents(season(null), season(podium), NOW);
  assert.equal(e[0].body, 'Hypercar : #8 Toyota Racing');
  assert.deepEqual(wecEvents(season(podium), season(podium), NOW), []);
});

test('fusion de l’historique : jamais deux fois le même événement', () => {
  const a = { id: 'x', topic: 'f1' as const, title: '', body: '', url: '', createdAt: '2026-10-01' };
  const { all, added } = mergeEvents([a], [a, { ...a, id: 'y', createdAt: NOW }]);
  assert.deepEqual(added.map((e) => e.id), ['y']);
  assert.deepEqual(all.map((e) => e.id), ['y', 'x']);
});

test('push : chaque abonné ne reçoit que ses sujets et ses marques, regroupés au-delà de 3', async () => {
  const { eventsFor, payloadsFor } = await import('../scripts/send-push.ts');
  const ev = (id: string, topic: 'releases' | 'f1', brandId: string | null = null) => ({ id, topic, title: id, body: '', url: 'x', createdAt: NOW, brandId });
  const events = [ev('a', 'releases', 'porsche'), ev('b', 'releases', 'bmw'), ev('c', 'f1')];
  assert.deepEqual(eventsFor({ topics: ['releases'], brands: ['porsche'] }, events).map((e) => e.id), ['a']);
  assert.deepEqual(eventsFor({ topics: ['releases', 'f1'], brands: [] }, events).map((e) => e.id), ['a', 'b', 'c']);
  assert.equal(payloadsFor([...events, ev('d', 'f1')], 'https://app/').length, 1);
  assert.equal(payloadsFor(events, 'https://app/')[0].url, 'https://app/x');
});
