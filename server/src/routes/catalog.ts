import { Hono } from 'hono';
import type { CategoryId, MarketCode, Powertrain, PriceRange } from '../../../shared/types.ts';
import type { CarDetail } from '../../../shared/api.ts';
import type { Preferences } from '../../../shared/profile.ts';
import { MARKETS } from '../../../shared/labels.ts';
import { catalog, resolvedImages, summarize } from '../catalog/store.ts';
import { catalogMeta, queryCars, similarCars, type CarQuery } from '../catalog/query.ts';

const list = (v: string | undefined) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function marketOf(v: string | undefined): MarketCode {
  return (MARKETS.find((m) => m.code === v)?.code ?? 'BE');
}

/** Préférences transmises en paramètres courts (pb, pc, pp, pr, pu, pper). */
export function prefsFromQuery(q: Record<string, string | undefined>): Partial<Preferences> | null {
  const prefs: Partial<Preferences> = {
    brands: list(q.pb),
    categories: list(q.pc) as CategoryId[],
    powertrains: list(q.pp) as Powertrain[],
    priceRanges: list(q.pr) as PriceRange[],
    usages: list(q.pu) as Preferences['usages'],
    periods: list(q.pper) as Preferences['periods'],
  };
  return Object.values(prefs).some((v) => Array.isArray(v) && v.length) ? prefs : null;
}

export const catalogRoutes = new Hono();

catalogRoutes.get('/meta', (c) => c.json({ ...catalogMeta(), warnings: catalog().warnings.length }));

catalogRoutes.get('/cars', (c) => {
  const q = c.req.query();
  const sorts: NonNullable<CarQuery['sort']>[] = ['relevance', 'newest', 'power', 'price-asc', 'price-desc', 'release'];
  const query: CarQuery = {
    q: q.q?.slice(0, 100),
    brands: list(q.brands),
    categories: list(q.categories) as CategoryId[],
    powertrains: list(q.powertrains) as Powertrain[],
    priceRanges: list(q.priceRanges) as PriceRange[],
    statuses: list(q.status) as CarQuery['statuses'],
    ids: list(q.ids),
    yearFrom: q.yearFrom ? Number(q.yearFrom) : undefined,
    yearTo: q.yearTo ? Number(q.yearTo) : undefined,
    sort: sorts.includes(q.sort as never) ? (q.sort as CarQuery['sort']) : 'relevance',
    market: marketOf(q.market),
    prefs: prefsFromQuery(q),
    page: Number(q.page) || 1,
    pageSize: Number(q.pageSize) || 24,
  };
  return c.json(queryCars(query));
});

catalogRoutes.get('/cars/:id', (c) => {
  const { generations, brands } = catalog();
  const g = generations.get(c.req.param('id'));
  if (!g) return c.json({ error: 'Cette fiche n’existe pas ou a été retirée du catalogue.' }, 404);
  const market = marketOf(c.req.query('market'));
  const previous = g.previousGenerationId ? generations.get(g.previousGenerationId) ?? null : null;
  const next = g.nextGenerationId ? generations.get(g.nextGenerationId) : null;
  const detail: CarDetail = {
    generation: g,
    summary: summarize(g, market),
    brand: brands.get(g.brandId)!,
    images: resolvedImages(g),
    previous,
    next: next ? summarize(next, market) : null,
    otherGenerations: [...generations.values()]
      .filter((o) => o.modelId === g.modelId && o.id !== g.id)
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0))
      .map((o) => summarize(o, market)),
    similar: similarCars(g, market),
  };
  return c.json(detail);
});
