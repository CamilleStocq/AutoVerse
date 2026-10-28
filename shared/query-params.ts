/**
 * Lecture des paramètres d'URL des requêtes catalogue et actualité.
 * Partagé par l'API et par l'application statique (même interprétation dans les deux modes).
 */
import type { CategoryId, MarketCode, Powertrain, PriceRange } from './types.ts';
import type { NewsCategory, NewsItem } from './api.ts';
import type { Preferences } from './profile.ts';
import type { CarQuery } from './catalog-engine.ts';
import { MARKETS } from './labels.ts';

type Q = Record<string, string | undefined>;

const list = (v: string | undefined) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function marketOf(v: string | undefined): MarketCode {
  return MARKETS.find((m) => m.code === v)?.code ?? 'BE';
}

/** Préférences transmises en paramètres courts (pb, pc, pp, pr, pu, pper). */
export function prefsFromQuery(q: Q): Partial<Preferences> | null {
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

const SORTS: NonNullable<CarQuery['sort']>[] = ['relevance', 'newest', 'power', 'price-asc', 'price-desc', 'release'];

export function carQueryFromParams(q: Q): CarQuery {
  return {
    q: q.q?.slice(0, 100),
    brands: list(q.brands),
    categories: list(q.categories) as CategoryId[],
    powertrains: list(q.powertrains) as Powertrain[],
    priceRanges: list(q.priceRanges) as PriceRange[],
    statuses: list(q.status) as CarQuery['statuses'],
    ids: list(q.ids),
    yearFrom: q.yearFrom ? Number(q.yearFrom) : undefined,
    yearTo: q.yearTo ? Number(q.yearTo) : undefined,
    sort: SORTS.includes(q.sort as never) ? (q.sort as CarQuery['sort']) : 'relevance',
    market: marketOf(q.market),
    prefs: prefsFromQuery(q),
    page: Number(q.page) || 1,
    pageSize: Number(q.pageSize) || 24,
  };
}

export const NEWS_SCOPES = ['auto', 'f1', 'wec', 'wrc'] as const;
export type NewsScope = (typeof NEWS_SCOPES)[number];

export function newsScopeOf(v: string | undefined): NewsScope {
  return NEWS_SCOPES.find((s) => s === v) ?? 'auto';
}

/** Filtrage, personnalisation (priorité sans exclusion) et pagination de l'actualité. */
export function filterNews(items: NewsItem[], q: Q, now = Date.now()) {
  const brands = list(q.brands);
  const categories = list(q.categories) as NewsCategory[];
  const prefBrands = list(q.pb);
  const search = q.q?.toLowerCase().trim();
  let filtered = items.filter((n) =>
    (!brands.length || n.brands.some((b) => brands.includes(b)))
    && (!categories.length || n.categories.some((cat) => categories.includes(cat)))
    && (!search || `${n.title} ${n.summary}`.toLowerCase().includes(search)));
  if (prefBrands.length && q.personal === '1') {
    filtered = filtered
      .map((n) => {
        const ageH = (now - Date.parse(n.publishedAt)) / 3.6e6;
        const relevance = (n.brands.some((b) => prefBrands.includes(b)) ? 48 : 0) + (n.source.type === 'manufacturer' ? 6 : 0) - ageH;
        return { ...n, relevance };
      })
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
  }
  const pageSize = Math.min(Number(q.pageSize) || 20, 60);
  const page = Math.max(Number(q.page) || 1, 1);
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize };
}
