/**
 * Agrégation des flux : récupération (cache 20 min, copie de secours si un flux tombe),
 * normalisation, classification, détection des doublons entre médias.
 */
import { createHash } from 'node:crypto';
import type { NewsItem } from '../../../shared/api.ts';
import { cached } from '../lib/cache.ts';
import { fetchText } from '../lib/http.ts';
import { classify, tagEntities } from './classify.ts';
import { parseFeed, type RawItem } from './rss.ts';
import { FEEDS, type FeedSource } from './sources.ts';

const FEED_TTL_MS = 20 * 60 * 1000;
const MAX_AGE_DAYS = 45;

export interface FeedStatus { id: string; name: string; ok: boolean; stale: boolean; fetchedAt: string | null; error?: string }

const STOPWORDS = new Set(('le la les un une des de du d l et en au aux pour par sur avec dans son sa ses ce cette est sont plus ne pas qui que '
  + 'the a an of to in on for with and its is are new from at by as this that will be').split(' '));

export function titleTokens(title: string): Set<string> {
  return new Set(
    title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function toItem(raw: RawItem, feed: FeedSource): NewsItem | null {
  if (!raw.title || !/^https?:\/\//.test(raw.link) || !raw.publishedAt) return null;
  const { brands, models } = tagEntities(raw.title, raw.summary, feed.brands);
  return {
    id: createHash('sha1').update(raw.link).digest('hex').slice(0, 16),
    title: raw.title,
    summary: raw.summary,
    url: raw.link,
    image: raw.image && /^https?:\/\//.test(raw.image) ? raw.image : null,
    publishedAt: raw.publishedAt,
    eventDate: null, // les flux ne fournissent pas de date d'événement structurée : jamais déduite
    source: { id: feed.id, name: feed.name, type: feed.type, homepage: feed.homepage },
    brands,
    models,
    categories: classify(raw.title, raw.summary),
    alsoReportedBy: [],
    lang: feed.lang,
  };
}

/**
 * Regroupe les reprises d'une même annonce : titres très proches (Jaccard ≥ 0,5)
 * publiés à moins de 72 h d'intervalle. La source primaire (constructeur) est conservée en tête.
 */
export function dedupe(items: NewsItem[]): NewsItem[] {
  const ordered = [...items].sort((a, b) =>
    (a.source.type === 'manufacturer' ? 0 : 1) - (b.source.type === 'manufacturer' ? 0 : 1)
    || a.publishedAt.localeCompare(b.publishedAt));
  const kept: Array<{ item: NewsItem; tokens: Set<string> }> = [];
  const seenUrls = new Set<string>();
  for (const item of ordered) {
    const url = item.url.split('?')[0];
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const tokens = titleTokens(item.title);
    const t = Date.parse(item.publishedAt);
    const dup = kept.find((k) => k.item.lang === item.lang
      && Math.abs(Date.parse(k.item.publishedAt) - t) < 72 * 3600 * 1000
      && jaccard(k.tokens, tokens) >= 0.5);
    if (dup) {
      dup.item.alsoReportedBy.push({ name: item.source.name, url: item.url });
      dup.item.brands = [...new Set([...dup.item.brands, ...item.brands])];
    } else {
      kept.push({ item, tokens });
    }
  }
  return kept.map((k) => k.item).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Flux complet d'une rubrique avec ses métadonnées de provenance (API et export statique). */
export async function newsFeed(scope: FeedSource['scope']) {
  const { items, feeds, fetchedAt, stale } = await loadNews(scope);
  return {
    items,
    feeds,
    fetchedAt,
    stale,
    sources: FEEDS.filter((f) => f.scope === scope).map((f) => ({ label: f.name, url: f.homepage })),
    errors: feeds.filter((f) => !f.ok).map((f) => `${f.name} : ${f.stale ? 'copie en cache servie' : 'indisponible'}${f.error ? ` (${f.error})` : ''}`),
  };
}

/** Vocabulaire des lancements (FR/EN), recherché dans le titre. */
const LAUNCH_RE = /(prochain|futur|à venir|arrive (en|chez|bientôt|in|to)|arrivera|dévoil|devoil|présent[eé]|présentation|révél|lancement|\blance (la|le|sa|son|une|un)|sortie|commercialis|commandes|teaser|prototype|espion|camoufl|nouvelle génération|next[- ]gen|restyl|facelift|unveil|reveal|debut|premiere|first look|confirm|coming|upcoming|will (arrive|launch|get)|production version|concept|nouveau (modèle|suv|coupé|break)|nouvelle (berline|citadine|version|gamme)|all-new|new generation)/i;
/** Articles qui ne parlent pas d'une sortie : essais, aides, rappels, trafic, finance… */
const NOT_LAUNCH_RE = /(\bessai|\breview\b|first drive|we drive|tested|\bprime\b|\bbonus\b|rappel|recall|carburant|bison futé|collection|occasion|assurance|amende|radar|bourse|résultats financiers|ventes|pilote|formule e|\brally|rallye|podium)/i;

/**
 * Article sur une future sortie de modèle : il concerne une marque identifiée et son titre
 * parle d'annonce, de présentation, de prochaine génération ou de commercialisation.
 */
export function isLaunchNews(n: NewsItem): boolean {
  return n.brands.length > 0 && LAUNCH_RE.test(n.title) && !NOT_LAUNCH_RE.test(n.title);
}

export async function loadNews(scope: FeedSource['scope']): Promise<{ items: NewsItem[]; feeds: FeedStatus[]; fetchedAt: string; stale: boolean }> {
  const feeds = FEEDS.filter((f) => f.scope === scope);
  const results = await Promise.all(feeds.map(async (feed) => {
    try {
      const r = await cached(`feed:${feed.id}`, FEED_TTL_MS, async () => parseFeed(await fetchText(feed.url, feed.name)));
      return { feed, raw: r.data, status: { id: feed.id, name: feed.name, ok: !r.stale, stale: r.stale, fetchedAt: r.fetchedAt, error: r.error } };
    } catch (e) {
      return { feed, raw: [] as RawItem[], status: { id: feed.id, name: feed.name, ok: false, stale: false, fetchedAt: null, error: e instanceof Error ? e.message : String(e) } };
    }
  }));
  const minDate = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
  const items = results.flatMap(({ feed, raw }) => raw.map((r) => toItem(r, feed)).filter((x): x is NewsItem => !!x && Date.parse(x.publishedAt) >= minDate))
    // Rubrique automobile recentrée sur les futures sorties de modèles (pas d'actualité générale).
    .filter((n) => scope !== 'auto' || isLaunchNews(n));
  const fetchedTimes = results.map((r) => r.status.fetchedAt).filter((x): x is string => !!x).sort();
  return {
    items: dedupe(items),
    feeds: results.map((r) => r.status),
    fetchedAt: fetchedTimes[0] ?? new Date().toISOString(),
    stale: results.some((r) => r.status.stale),
  };
}
