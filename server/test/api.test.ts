import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app.ts';
import { loadCatalog } from '../src/catalog/store.ts';
import { cached } from '../src/lib/cache.ts';
import { eventStatus, loadSnapshot } from '../src/sport/snapshot.ts';
import { generation, seedDir } from './fixtures.ts';

const app = createApp();
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const json = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const prefs = { brands: ['porsche'], categories: ['sports'], powertrains: [], priceRanges: [], periods: [], usages: [], interests: [], market: 'BE' };

test('profil : identifiant validé, préférences persistées et relues', async () => {
  assert.equal((await app.request('/api/profile/pas-un-uuid')).status, 400);
  assert.equal(await (await app.request(`/api/profile/${ID}`)).json(), null);
  const put = await app.request(`/api/profile/${ID}`, json({ onboardedAt: '2026-10-28T10:00:00Z', preferences: prefs }));
  assert.equal(put.status, 200);
  const got = await (await app.request(`/api/profile/${ID}`)).json();
  assert.deepEqual(got.preferences.brands, ['porsche']);
  const bad = await app.request(`/api/profile/${ID}`, json({ onboardedAt: null, preferences: { ...prefs, market: 'XX' } }));
  assert.equal(bad.status, 400);
});

test('wishlist : ajout, relecture, suppression immédiates', async () => {
  const snap = { id: 'porsche-911', brandName: 'Porsche', modelName: '911' };
  assert.equal((await app.request(`/api/profile/${ID}/wishlist/porsche-911`, json({ snapshot: snap }))).status, 200);
  assert.equal((await app.request(`/api/profile/${ID}/wishlist/autre-id`, json({ snapshot: snap }))).status, 400, 'instantané incohérent refusé');
  let list = await (await app.request(`/api/profile/${ID}/wishlist`)).json();
  assert.deepEqual(list.map((w: { generationId: string }) => w.generationId), ['porsche-911']);
  assert.equal((await app.request(`/api/profile/${ID}/wishlist/porsche-911`, { method: 'DELETE' })).status, 204);
  list = await (await app.request(`/api/profile/${ID}/wishlist`)).json();
  assert.equal(list.length, 0);
});

test('fiche inexistante : 404 avec message compréhensible', async () => {
  loadCatalog(seedDir({ 'catalog-x.json': { generations: [generation('porsche-911')] } }));
  const res = await app.request('/api/cars/inconnue');
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /n’existe pas/);
  const ok = await (await app.request('/api/cars/porsche-911?market=BE')).json();
  assert.equal(ok.summary.id, 'porsche-911');
});

test('cache : la dernière copie est servie si la source tombe', async () => {
  const first = await cached('test:key', -1, async () => ({ v: 1 })); // expire immédiatement
  assert.equal(first.stale, false);
  const second = await cached('test:key', 1000, async () => { throw new Error('source HS'); });
  assert.equal(second.stale, true);
  assert.deepEqual(second.data, { v: 1 });
  await assert.rejects(cached('test:none', 1000, async () => { throw new Error('HS'); }));
});

test('sport : statut recalculé selon la date, résultats jamais montrés avant la course', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  assert.equal(eventStatus({ startDate: '2026-11-06', endDate: '2026-11-08', status: 'upcoming' }, now), 'upcoming');
  assert.equal(eventStatus({ startDate: '2026-10-27', endDate: '2026-10-29', status: 'upcoming' }, now), 'live');
  assert.equal(eventStatus({ startDate: '2026-10-01', endDate: '2026-10-03', status: 'upcoming' }, now), 'completed');
  assert.equal(eventStatus({ startDate: null, endDate: null, status: 'upcoming' }, now), 'upcoming');
  assert.equal(eventStatus({ startDate: '2026-10-01', endDate: '2026-10-03', status: 'cancelled' }, now), 'cancelled');

  const dir = seedDir({});
  writeFileSync(path.join(dir, 'motorsport-2026.json'), JSON.stringify({
    snapshotAt: '2026-10-28',
    wec: { season: 2026, classes: [], manufacturers: [], sources: [], standings: null, events: [
      { round: 8, name: 'Futur', shortName: 'F', circuit: 'c', country: 'x', countryCode: 'IT', startDate: '2026-11-06', endDate: '2026-11-08', raceStartUtc: null, timezone: 'Europe/Rome', durationLabel: null, status: 'completed', sources: [],
        results: [{ classId: 'hypercar', podium: [{ position: 1, carNumber: '1', team: 'erreur', manufacturer: null, car: null, drivers: [] }] }] },
    ] },
    wrc: null,
  }));
  const snap = loadSnapshot(now, dir)!;
  assert.equal(snap.wec!.events[0].status, 'upcoming');
  assert.equal(snap.wec!.events[0].results, null, 'aucun podium affiché pour une épreuve à venir');
});
