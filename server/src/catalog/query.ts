import type { CategoryId, Generation, MarketCode, Powertrain, PriceRange } from '../../../shared/types.ts';
import type { CarSummary, CatalogMeta, FacetCount, Paged, SimilarCar } from '../../../shared/api.ts';
import type { Preferences } from '../../../shared/profile.ts';
import { comparePartialDates } from '../../../shared/dates.ts';
import { CATEGORY_LABELS, POWERTRAIN_LABELS } from '../../../shared/labels.ts';
import { catalog, powertrainsOf, summarize } from './store.ts';

export interface CarQuery {
  q?: string;
  brands?: string[];
  categories?: CategoryId[];
  powertrains?: Powertrain[];
  priceRanges?: PriceRange[];
  statuses?: Array<'on-sale' | 'upcoming' | 'discontinued'>;
  yearFrom?: number;
  yearTo?: number;
  ids?: string[];
  sort?: 'relevance' | 'newest' | 'power' | 'price-asc' | 'price-desc' | 'release';
  market: MarketCode;
  prefs?: Partial<Preferences> | null;
  page?: number;
  pageSize?: number;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function haystack(g: Generation): string {
  const brand = catalog().brands.get(g.brandId)?.name ?? '';
  return normalize([brand, g.modelName, g.name, g.segment, ...g.bodyStyles, ...g.variants.map((v) => v.name)].join(' '));
}

function matchesStatus(g: Generation, statuses: CarQuery['statuses']): boolean {
  if (!statuses?.length) return true;
  const isUpcoming = !!g.upcoming && g.status !== 'discontinued' && g.status !== 'on-sale';
  return statuses.some((s) =>
    s === 'upcoming' ? isUpcoming || (!!g.upcoming && g.status === 'on-sale')
      : s === 'on-sale' ? g.status === 'on-sale'
        : g.status === 'discontinued');
}

/**
 * Score de personnalisation : les préférences orientent l'ordre, elles ne filtrent jamais.
 * L'exploration reste donc ouverte à toutes les marques.
 */
export function preferenceScore(g: Generation, prefs: Partial<Preferences> | null | undefined): number {
  if (!prefs) return 0;
  let s = 0;
  if (Array.isArray(prefs.brands) && prefs.brands.includes(g.brandId)) s += 4;
  const cats = prefs.categories ?? [];
  s += Math.min(3, g.categories.filter((c) => cats.includes(c)).length * 1.5);
  const pts = powertrainsOf(g);
  if (prefs.powertrains?.some((p) => pts.includes(p))) s += 1;
  if (g.priceRange && prefs.priceRanges?.includes(g.priceRange)) s += 1;
  if (prefs.usages?.some((u) => g.usage.includes(u))) s += 0.5;
  const periods = prefs.periods ?? [];
  if (periods.length) {
    const isClassic = g.categories.includes('classic');
    if (periods.includes('classic') && isClassic) s += 1;
    if (periods.includes('upcoming') && g.upcoming) s += 1;
    if (periods.includes('current') && g.status === 'on-sale' && !isClassic) s += 0.5;
    if (!periods.includes('classic') && g.status === 'discontinued') s -= 1;
  } else if (g.status === 'discontinued' && !g.categories.includes('classic')) {
    s -= 1; // anciennes générations : consultables, mais pas mises en avant par défaut
  }
  return s;
}

export function filterGenerations(query: CarQuery): Generation[] {
  const { generations } = catalog();
  const q = query.q ? normalize(query.q.trim()) : '';
  const terms = q.split(/\s+/).filter(Boolean);
  return [...generations.values()].filter((g) => {
    if (query.ids?.length && !query.ids.includes(g.id)) return false;
    if (terms.length) {
      const h = haystack(g);
      if (!terms.every((t) => h.includes(t))) return false;
    }
    if (query.brands?.length && !query.brands.includes(g.brandId)) return false;
    if (query.categories?.length && !query.categories.some((c) => g.categories.includes(c))) return false;
    if (query.powertrains?.length && !powertrainsOf(g).some((p) => query.powertrains!.includes(p))) return false;
    if (query.priceRanges?.length && (!g.priceRange || !query.priceRanges.includes(g.priceRange))) return false;
    if (!matchesStatus(g, query.statuses)) return false;
    const year = g.startYear;
    if (query.yearFrom && (year == null || year < query.yearFrom)) return false;
    if (query.yearTo && (year == null || year > query.yearTo)) return false;
    return true;
  });
}

const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) =>
  a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : (a - b) * dir;

export function queryCars(query: CarQuery): Paged<CarSummary> {
  const list = filterGenerations(query).map((g) => ({ g, s: summarize(g, query.market), score: preferenceScore(g, query.prefs) }));
  const sort = query.sort ?? 'relevance';
  list.sort((a, b) => {
    switch (sort) {
      case 'newest': return nullsLast(a.g.startYear, b.g.startYear, -1) || a.s.modelName.localeCompare(b.s.modelName);
      case 'power': return nullsLast(a.s.maxPowerHp, b.s.maxPowerHp, -1);
      case 'price-asc': return nullsLast(a.s.startingPrice?.amount ?? null, b.s.startingPrice?.amount ?? null, 1);
      case 'price-desc': return nullsLast(a.s.startingPrice?.amount ?? null, b.s.startingPrice?.amount ?? null, -1);
      case 'release': return comparePartialDates(a.s.releaseDate, b.s.releaseDate);
      default: return b.score - a.score || nullsLast(a.g.startYear, b.g.startYear, -1) || a.s.brandName.localeCompare(b.s.brandName);
    }
  });
  const pageSize = Math.min(Math.max(query.pageSize ?? 24, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  return {
    items: list.slice((page - 1) * pageSize, page * pageSize).map((x) => x.s),
    total: list.length,
    page,
    pageSize,
  };
}

// ---------- Modèles similaires ----------

const BODY_CATEGORIES = new Set<CategoryId>(['sports', 'supercar', 'sport-sedan', 'coupe', 'convertible', 'city', 'compact', 'family-sedan', 'wagon', 'suv', 'sport-suv', 'luxury', 'gt', 'offroad']);
const PRICE_ORDER: PriceRange[] = ['budget', 'mid', 'premium', 'luxury'];

function maxOf(g: Generation, pick: (v: Generation['variants'][number]) => number | null): number | null {
  const vals = g.variants.map(pick).filter((x): x is number => x != null);
  return vals.length ? Math.max(...vals) : null;
}

export function similarCars(target: Generation, market: MarketCode, limit = 6): SimilarCar[] {
  const out: SimilarCar[] = [];
  const tPower = maxOf(target, (v) => v.powerHp);
  const tLength = maxOf(target, (v) => v.dimensions?.lengthMm ?? null);
  const tPts = powertrainsOf(target);
  for (const g of catalog().generations.values()) {
    if (g.id === target.id || g.modelId === target.modelId || g.status === 'discontinued') continue;
    const reasons: string[] = [];
    let score = 0;
    const shared = g.categories.filter((c) => BODY_CATEGORIES.has(c) && target.categories.includes(c));
    if (shared.length) {
      score += shared.length * 2;
      reasons.push(`Même catégorie : ${shared.slice(0, 2).map((c) => CATEGORY_LABELS[c].toLowerCase()).join(', ')}`);
    }
    if (g.priceRange && target.priceRange) {
      const d = Math.abs(PRICE_ORDER.indexOf(g.priceRange) - PRICE_ORDER.indexOf(target.priceRange));
      if (d === 0) { score += 2; reasons.push('Même gamme de prix'); }
      else if (d === 1) score += 0.5;
    }
    const power = maxOf(g, (v) => v.powerHp);
    if (power && tPower && Math.abs(power - tPower) / tPower <= 0.2) {
      score += 2;
      reasons.push(`Puissance comparable (${power} ch contre ${tPower} ch)`);
    }
    const length = maxOf(g, (v) => v.dimensions?.lengthMm ?? null);
    if (length && tLength && Math.abs(length - tLength) <= 150) {
      score += 1;
      reasons.push(`Gabarit proche (${(length / 1000).toFixed(2).replace('.', ',')} m contre ${(tLength / 1000).toFixed(2).replace('.', ',')} m)`);
    }
    const pts = powertrainsOf(g).filter((p) => tPts.includes(p));
    if (pts.length) {
      score += 1;
      reasons.push(`Motorisation ${pts.map((p) => POWERTRAIN_LABELS[p].toLowerCase()).join(' / ')} également`);
    }
    if (g.usage.some((u) => target.usage.includes(u))) score += 0.5;
    if (g.brandId !== target.brandId && shared.length) reasons.push('Concurrent direct sur le marché');
    if (score >= 4 && shared.length) out.push({ car: summarize(g, market), reasons, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------- Méta (facettes) ----------

export function catalogMeta(): CatalogMeta {
  const { brands, generations } = catalog();
  const gens = [...generations.values()];
  const count = <K extends string>(keys: K[], pick: (g: Generation) => K[], labels: Record<K, string>): FacetCount[] =>
    keys.map((k) => ({ id: k, label: labels[k], count: gens.filter((g) => pick(g).includes(k)).length }));
  const years = gens.map((g) => g.startYear).filter((y): y is number => y != null);
  const updated = gens.map((g) => g.updatedAt).sort().at(-1) ?? null;
  return {
    brands: [...brands.values()]
      .map((b) => ({ ...b, carCount: gens.filter((g) => g.brandId === b.id).length }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: count(Object.keys(CATEGORY_LABELS) as CategoryId[], (g) => g.categories, CATEGORY_LABELS),
    powertrains: count(Object.keys(POWERTRAIN_LABELS) as Powertrain[], powertrainsOf, POWERTRAIN_LABELS),
    years: years.length ? { min: Math.min(...years), max: Math.max(...years) } : null,
    totalCars: gens.length,
    dataUpdatedAt: updated,
  };
}
