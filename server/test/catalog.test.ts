import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, startingPrice, summarize } from '../src/catalog/store.ts';
import { queryCars, similarCars } from '../src/catalog/query.ts';
import { generation, seedDir, testSource, variant } from './fixtures.ts';

const price = (market: string, amount: number, type = 'range-start', extra: Record<string, unknown> = {}) =>
  ({ market, amount, currency: 'EUR', type, asOf: '2026-09-01', source: testSource, ...extra });

test('une fiche invalide est écartée avec un avertissement, sans bloquer les autres', () => {
  const dir = seedDir({
    'catalog-x.json': { generations: [generation('porsche-ok'), { id: 'cassee', brandId: 'porsche' }, generation('inconnue', { brandId: 'nope' })] },
  });
  const state = loadCatalog(dir);
  assert.equal(state.generations.size, 1);
  assert.ok(state.warnings.some((w) => w.includes('cassee')));
  assert.ok(state.warnings.some((w) => w.includes('marque inconnue')));
});

test('les catégories de motorisation viennent des variantes, jamais du nom', () => {
  const dir = seedDir({
    'catalog-x.json': { generations: [generation('porsche-e', {
      modelName: 'Electric Hybrid GT', // le nom ne doit rien déduire
      categories: ['sports', 'ev'],
      variants: [variant('a', { powertrain: 'phev' }), variant('b', { powertrain: 'petrol' })],
    })] },
  });
  const g = loadCatalog(dir).generations.get('porsche-e')!;
  assert.deepEqual(g.categories.sort(), ['ice', 'phev', 'sports']);
});

test('sans génération précédente identifiée, aucune comparaison automatique', () => {
  const changes = { previousGenerationId: 'porsche-absente', comparablePair: null, design: ['x'], technology: [], equipment: [], chassis: [], unchanged: [], tradeoffs: [], sources: [] };
  const dir = seedDir({ 'catalog-x.json': { generations: [generation('porsche-new', { previousGenerationId: 'porsche-absente', changes })] } });
  assert.equal(loadCatalog(dir).generations.get('porsche-new')!.changes, null);
});

test('une paire de versions comparables inexistante désactive la comparaison chiffrée', () => {
  const prev = generation('porsche-old', { status: 'discontinued' });
  const changes = { previousGenerationId: 'porsche-old', comparablePair: { currentVariantId: 'porsche-new-base', previousVariantId: 'fantome' }, design: [], technology: [], equipment: [], chassis: [], unchanged: [], tradeoffs: [], sources: [] };
  const dir = seedDir({ 'catalog-x.json': { generations: [prev, generation('porsche-new', { previousGenerationId: 'porsche-old', changes })] } });
  const state = loadCatalog(dir);
  assert.equal(state.generations.get('porsche-new')!.changes!.comparablePair, null);
  assert.equal(state.generations.get('porsche-old')!.nextGenerationId, 'porsche-new');
});

test('prix : pas de repli silencieux vers un autre marché, estimation séparée', () => {
  const dir = seedDir({ 'catalog-x.json': { generations: [generation('porsche-p', {
    variants: [variant('v1', { prices: [price('FR', 50000), price('BE', 70000, 'estimate', { estimate: { low: 65000, high: 75000, confidence: 'low' } })] })],
  })] } });
  const g = loadCatalog(dir).generations.get('porsche-p')!;
  assert.equal(startingPrice(g, 'BE'), null, 'aucun prix officiel belge');
  const s = summarize(g, 'BE');
  assert.equal(s.startingPrice, null);
  assert.equal(s.estimatedPrice?.type, 'estimate');
  assert.equal(s.otherMarketPrice?.market, 'FR', 'le prix français est proposé, étiqueté comme tel');
  assert.equal(summarize(g, 'FR').startingPrice?.amount, 50000);
});

test('une estimation sans fourchette est refusée', () => {
  const dir = seedDir({ 'catalog-x.json': { generations: [generation('porsche-bad', { variants: [variant('v', { prices: [price('BE', 1, 'estimate')] })] })] } });
  assert.equal(loadCatalog(dir).generations.size, 0);
});

test('les préférences réordonnent le catalogue sans masquer les autres marques', () => {
  const dir = seedDir({ 'catalog-x.json': { generations: [
    generation('porsche-a', { startYear: 2020 }),
    generation('bmw-b', { brandId: 'bmw', startYear: 2025, categories: ['suv'] }),
  ] } });
  loadCatalog(dir);
  const res = queryCars({ market: 'BE', prefs: { brands: ['bmw'] } });
  assert.equal(res.total, 2);
  assert.equal(res.items[0].id, 'bmw-b');
  const res2 = queryCars({ market: 'BE', prefs: { brands: ['porsche'] } });
  assert.equal(res2.items[0].id, 'porsche-a');
});

test('recherche insensible aux accents et filtres combinés', () => {
  const dir = seedDir({ 'catalog-x.json': { generations: [
    generation('porsche-a', { segment: 'Coupé sportif' }),
    generation('bmw-b', { brandId: 'bmw', categories: ['suv'], variants: [variant('x', { powertrain: 'ev' })] }),
  ] } });
  loadCatalog(dir);
  assert.equal(queryCars({ market: 'BE', q: 'sportif' }).total, 1);
  assert.equal(queryCars({ market: 'BE', q: 'coupe' }).total, 2, 'Coupé trouvé sans accent');
  assert.equal(queryCars({ market: 'BE', powertrains: ['ev'] }).items[0].id, 'bmw-b');
  assert.equal(queryCars({ market: 'BE', brands: ['bmw'], categories: ['sports'] }).total, 0);
});

test('modèles similaires : chaque suggestion est justifiée', () => {
  const dir = seedDir({ 'catalog-x.json': { generations: [
    generation('porsche-a'),
    generation('bmw-b', { brandId: 'bmw' }),
    generation('bmw-c', { brandId: 'bmw', categories: ['city'], priceRange: 'budget', variants: [variant('z', { powerHp: 90, dimensions: null })] }),
  ] } });
  const state = loadCatalog(dir);
  const sims = similarCars(state.generations.get('porsche-a')!, 'BE');
  assert.deepEqual(sims.map((s) => s.car.id), ['bmw-b']);
  assert.ok(sims[0].reasons.length >= 2);
});
