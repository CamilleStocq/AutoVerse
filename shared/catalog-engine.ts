/**
 * Moteur du catalogue : résumés de cartes, prix, recherche, personnalisation, similarité, fiche.
 * Code pur (sans accès disque ni réseau) partagé par l'API Node et par l'application statique,
 * pour garantir exactement les mêmes règles métier dans les deux modes.
 */
import type { Brand, CategoryId, Generation, MarketCode, Powertrain, PriceRange } from './types.ts';
import type { CarDetail, CarSummary, CatalogMeta, FacetCount, Paged, PriceView, ResolvedImage, SimilarCar } from './api.ts';
import type { Preferences } from './profile.ts';
import { comparePartialDates } from './dates.ts';
import { CATEGORY_LABELS, POWERTRAIN_LABELS } from './labels.ts';

export interface CatalogContext {
  brands: Map<string, Brand>;
  generations: Map<string, Generation>;
  imagesFor: (g: Generation) => ResolvedImage[];
}

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

export function powertrainsOf(g: Generation): Powertrain[] {
  const fromVariants = g.variants.map((v) => v.powertrain);
  const list = fromVariants.length ? fromVariants : (g.upcoming?.expectedPowertrains ?? []);
  return [...new Set(list)];
}

// ---------- Prix ----------

export const MARKET_FALLBACK: MarketCode[] = ['BE', 'FR', 'LU', 'NL', 'DE', 'IT', 'ES', 'CH', 'GB'];

function pricesFor(g: Generation, market: MarketCode, estimate: boolean): PriceView[] {
  return g.variants.flatMap((v) =>
    v.prices
      .filter((p) => p.market === market && (p.type === 'estimate') === estimate)
      .map((p) => ({ amount: p.amount, currency: p.currency, market: p.market, type: p.type, asOf: p.asOf, variantName: v.name, source: p.source, estimate: p.estimate ?? null })),
  );
}

/**
 * Prix de départ sur le marché demandé. Aucun repli silencieux vers un autre pays :
 * si le marché n'a pas de prix, l'autre marché est fourni à part et toujours nommé.
 */
export function startingPrice(g: Generation, market: MarketCode, estimate = false): PriceView | null {
  const list = pricesFor(g, market, estimate);
  if (!list.length) return null;
  return list.reduce((min, p) => (p.amount < min.amount ? p : min));
}

// ---------- Résumés pour les cartes ----------

const RELEASE_KEYS = ['marketAvailability', 'firstDeliveries', 'ordersOpen', 'presentation'] as const;

function keyFact(g: Generation): CarSummary['keyFact'] {
  const powers = g.variants.map((v) => v.powerHp).filter((p): p is number => p != null);
  const ranges = g.variants.map((v) => v.electricRangeKm).filter((p): p is number => p != null);
  const isEv = g.variants.length > 0 && g.variants.every((v) => v.powertrain === 'ev');
  if (isEv && ranges.length && !g.categories.some((c) => c === 'sports' || c === 'supercar')) {
    return { label: 'Autonomie WLTP', value: `jusqu'à ${Math.max(...ranges)} km` };
  }
  if (powers.length) {
    const min = Math.min(...powers);
    const max = Math.max(...powers);
    return { label: 'Puissance', value: min === max ? `${max} ch` : `${min} – ${max} ch` };
  }
  return null;
}

export function summarize(ctx: CatalogContext, g: Generation, market: MarketCode): CarSummary {
  const brand = ctx.brands.get(g.brandId)!;
  const images = ctx.imagesFor(g);
  const powers = g.variants.map((v) => v.powerHp).filter((p): p is number => p != null);
  const releaseKey = g.launch ? RELEASE_KEYS.find((k) => g.launch?.[k]?.date) ?? null : null;
  const local = startingPrice(g, market);
  return {
    id: g.id,
    brandId: g.brandId,
    brandName: brand.name,
    brandAccent: brand.accent,
    modelId: g.modelId,
    modelName: g.modelName,
    generationName: g.name,
    yearsLabel: g.yearsLabel,
    startYear: g.startYear,
    status: g.status,
    confirmation: g.upcoming?.confirmation ?? null,
    categories: g.categories,
    powertrains: powertrainsOf(g),
    segment: g.segment,
    bodyStyles: g.bodyStyles,
    priceRange: g.priceRange,
    image: images[0] ?? null,
    keyFact: keyFact(g),
    maxPowerHp: powers.length ? Math.max(...powers) : null,
    startingPrice: local,
    otherMarketPrice: local ? null : (MARKET_FALLBACK.filter((m) => m !== market).map((m) => startingPrice(g, m)).find((p) => !!p) ?? null),
    estimatedPrice: startingPrice(g, market, true),
    releaseDate: releaseKey ? g.launch![releaseKey]!.date : null,
    releaseDateKind: releaseKey,
    isUpcoming: !!g.upcoming && g.status !== 'discontinued',
    variantCount: g.variants.length,
    updatedAt: g.updatedAt,
  };
}

// ---------- Recherche et personnalisation ----------

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function haystack(ctx: CatalogContext, g: Generation): string {
  const brand = ctx.brands.get(g.brandId)?.name ?? '';
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

export function filterGenerations(ctx: CatalogContext, query: CarQuery): Generation[] {
  const q = query.q ? normalize(query.q.trim()) : '';
  const terms = q.split(/\s+/).filter(Boolean);
  return [...ctx.generations.values()].filter((g) => {
    if (query.ids?.length && !query.ids.includes(g.id)) return false;
    if (terms.length) {
      const h = haystack(ctx, g);
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

export function queryCars(ctx: CatalogContext, query: CarQuery): Paged<CarSummary> {
  const list = filterGenerations(ctx, query).map((g) => ({ g, s: summarize(ctx, g, query.market), score: preferenceScore(g, query.prefs) }));
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

const meters = (mm: number) => (mm / 1000).toFixed(2).replace('.', ',');

export function similarCars(ctx: CatalogContext, target: Generation, market: MarketCode, limit = 6): SimilarCar[] {
  const out: SimilarCar[] = [];
  const tPower = maxOf(target, (v) => v.powerHp);
  const tLength = maxOf(target, (v) => v.dimensions?.lengthMm ?? null);
  const tPts = powertrainsOf(target);
  for (const g of ctx.generations.values()) {
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
      reasons.push(`Gabarit proche (${meters(length)} m contre ${meters(tLength)} m)`);
    }
    const pts = powertrainsOf(g).filter((p) => tPts.includes(p));
    if (pts.length) {
      score += 1;
      reasons.push(`Motorisation ${pts.map((p) => POWERTRAIN_LABELS[p].toLowerCase()).join(' / ')} également`);
    }
    if (g.usage.some((u) => target.usage.includes(u))) score += 0.5;
    if (g.brandId !== target.brandId && shared.length) reasons.push('Concurrent direct sur le marché');
    if (score >= 4 && shared.length) out.push({ car: summarize(ctx, g, market), reasons, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------- Fiche complète ----------

export function carDetail(ctx: CatalogContext, id: string, market: MarketCode): CarDetail | null {
  const g = ctx.generations.get(id);
  if (!g) return null;
  const previous = g.previousGenerationId ? ctx.generations.get(g.previousGenerationId) ?? null : null;
  const next = g.nextGenerationId ? ctx.generations.get(g.nextGenerationId) : null;
  return {
    generation: g,
    summary: summarize(ctx, g, market),
    brand: ctx.brands.get(g.brandId)!,
    images: ctx.imagesFor(g),
    previous,
    next: next ? summarize(ctx, next, market) : null,
    otherGenerations: [...ctx.generations.values()]
      .filter((o) => o.modelId === g.modelId && o.id !== g.id)
      .sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0))
      .map((o) => summarize(ctx, o, market)),
    similar: similarCars(ctx, g, market),
  };
}

// ---------- Méta (facettes) ----------

export function catalogMeta(ctx: CatalogContext): CatalogMeta {
  const gens = [...ctx.generations.values()];
  const count = <K extends string>(keys: K[], pick: (g: Generation) => K[], labels: Record<K, string>): FacetCount[] =>
    keys.map((k) => ({ id: k, label: labels[k], count: gens.filter((g) => pick(g).includes(k)).length }));
  const years = gens.map((g) => g.startYear).filter((y): y is number => y != null);
  const updated = gens.map((g) => g.updatedAt).sort().at(-1) ?? null;
  return {
    brands: [...ctx.brands.values()]
      .map((b) => ({ ...b, carCount: gens.filter((g) => g.brandId === b.id).length }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: count(Object.keys(CATEGORY_LABELS) as CategoryId[], (g) => g.categories, CATEGORY_LABELS),
    powertrains: count(Object.keys(POWERTRAIN_LABELS) as Powertrain[], powertrainsOf, POWERTRAIN_LABELS),
    years: years.length ? { min: Math.min(...years), max: Math.max(...years) } : null,
    totalCars: gens.length,
    dataUpdatedAt: updated,
  };
}
