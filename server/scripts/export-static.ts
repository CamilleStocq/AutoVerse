/**
 * Export des données en fichiers JSON statiques pour l'application hébergée sans serveur
 * (GitHub Pages). Exécuté par GitHub Actions toutes les 30 minutes :
 *   node --env-file-if-exists=.env scripts/export-static.ts <dossier de sortie>
 *
 * - Chaque source est exportée indépendamment : une source en panne n'empêche pas les autres
 *   d'être publiées, et la dernière version en ligne est alors conservée.
 * - Les changements par rapport à la version en ligne (nouvelles dates de sortie, résultats
 *   F1 / WEC / WRC) deviennent des alertes : events.json (centre d'alertes de l'app) et
 *   NEW_EVENTS_FILE (alertes nouvelles, envoyées en notification push par le workflow).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppEvent, ResolvedImage } from '../../shared/api.ts';
import type { Brand, Generation } from '../../shared/types.ts';
import type { F1Overview, WecSeason, WrcSeason } from '../../shared/sport.ts';
import { catalog, loadCatalog, resolvedImages, warmImages } from '../src/catalog/store.ts';
import { newsFeed } from '../src/news/aggregate.ts';
import { NEWS_SCOPES } from '../../shared/query-params.ts';
import { f1Overview, f1Round, F1_SOURCE } from '../src/sport/f1.ts';
import { loadSnapshot } from '../src/sport/snapshot.ts';
import { sportCalendar } from '../src/sport/calendar.ts';
import { f1Events, mergeEvents, releaseEvents, wecEvents, wrcEvents } from '../src/events.ts';

const out = path.resolve(process.argv[2] ?? path.join('..', 'web', 'public', 'data'));
mkdirSync(out, { recursive: true });

/** Site déjà publié (ex. https://user.github.io/Repo/) : repli en cas de panne et base de comparaison. */
const PUBLISHED = process.env.PUBLISHED_URL?.replace(/\/?$/, '/');

const fresh = new Map<string, unknown>(); // fichiers produits par cette exécution
const write = (name: string, data: unknown, isFresh = true) => {
  writeFileSync(path.join(out, name), JSON.stringify(data));
  if (isFresh) fresh.set(name, data);
  console.log(`  ✓ ${name}${isFresh ? '' : ' (version publiée conservée)'}`);
};

const publishedCache = new Map<string, Promise<unknown | null>>();
/** Lit un fichier de la version en ligne (mémorisé). */
function fetchPublished<T>(name: string): Promise<T | null> {
  if (!PUBLISHED) return Promise.resolve(null);
  if (!publishedCache.has(name)) {
    publishedCache.set(name, fetch(`${PUBLISHED}data/${name}`, { signal: AbortSignal.timeout(20_000) })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null));
  }
  return publishedCache.get(name)! as Promise<T | null>;
}

/** Recopie un fichier de la version en ligne, marqué comme dernière copie connue. */
async function republish(name: string): Promise<unknown | null> {
  const data = await fetchPublished<Record<string, unknown>>(name);
  if (!data) return null;
  write(name, 'fetchedAt' in data ? { ...data, stale: true } : data, false);
  return data;
}

const report: Record<string, string> = {};
async function step(name: string, fn: () => Promise<void> | void, fallback?: () => Promise<void>) {
  try {
    await fn();
    report[name] = 'ok';
  } catch (e) {
    report[name] = e instanceof Error ? e.message : String(e);
    console.warn(`  ✗ ${name} : ${report[name]}`);
    if (fallback) {
      await fallback();
      report[name] += ' (dernière version publiée conservée)';
    }
  }
}

type CatalogFile = { brands: Brand[]; generations: Generation[]; images: Record<string, ResolvedImage[]> };
type Envelope<T> = { data: T };

console.log(`[export] vers ${out}`);

await step('catalogue', async () => {
  loadCatalog();
  await warmImages();
  const { brands, generations, warnings } = catalog();
  const images: Record<string, ResolvedImage[]> = {};
  for (const g of generations.values()) images[g.id] = resolvedImages(g);
  // Wikimedia indisponible : on reprend les photos déjà publiées plutôt que des fiches sans image.
  const missing = [...generations.values()].filter((g) => g.images.some((i) => i.commonsFile) && !images[g.id].length);
  if (missing.length) {
    const prev = (await fetchPublished<CatalogFile>('catalog.json'))?.images ?? {};
    let reused = 0;
    for (const g of missing) {
      // Seulement si la photo publiée correspond toujours à la fiche (même description).
      const known = new Set(g.images.map((i) => i.depicts));
      const kept = (prev[g.id] ?? []).filter((i) => known.has(i.depicts));
      if (kept.length) { images[g.id] = kept; reused++; }
    }
    if (reused) console.warn(`  ! ${reused} fiche(s) : photos reprises de la version publiée`);
  }
  if (warnings.length) console.warn(`  ! ${warnings.length} avertissement(s) de validation`);
  write('catalog.json', { brands: [...brands.values()], generations: [...generations.values()], images });
});

for (const scope of NEWS_SCOPES) {
  await step(`actualite-${scope}`, async () => {
    const feed = await newsFeed(scope);
    // Tous les flux en échec sans copie en cache : on ne publie pas une actualité vide.
    if (!feed.items.length && feed.feeds.every((f) => !f.ok && !f.stale)) throw new Error('aucun flux disponible');
    write(`news-${scope}.json`, feed);
  }, async () => { await republish(`news-${scope}.json`); });
}

await step('f1', async () => {
  const r = await f1Overview();
  write('f1.json', { data: r.data, fetchedAt: r.fetchedAt, stale: r.stale, sources: [F1_SOURCE], errors: r.error ? [r.error] : [] });
  // Détail des manches disputées et de la prochaine : séquentiel pour respecter les limites de l'API.
  const rounds = r.data.schedule.filter((x) => x.status !== 'upcoming' || x.round === r.data.nextRace?.round);
  for (const race of rounds) {
    const d = await f1Round(String(r.data.season), race.round);
    await new Promise((res) => setTimeout(res, 250)); // ~4 req/s max côté Jolpica
    if (d.data) write(`f1-${r.data.season}-${race.round}.json`, { data: d.data, fetchedAt: d.fetchedAt, stale: d.stale, sources: [F1_SOURCE], errors: [] });
  }
}, async () => {
  // Repli : vue d'ensemble et manches déjà publiées (sauf celles rafraîchies pendant cette exécution).
  const prev = fresh.has('f1.json') ? null : await republish('f1.json');
  const schedule = (prev as Envelope<F1Overview> | null)?.data?.schedule ?? [];
  for (const race of schedule) {
    const name = `f1-${race.season}-${race.round}.json`;
    if (race.status !== 'upcoming' && !fresh.has(name)) await republish(name);
  }
});

await step('wec-wrc', () => {
  const snap = loadSnapshot();
  if (!snap) throw new Error('instantané WEC/WRC introuvable');
  for (const series of ['wec', 'wrc'] as const) {
    const data = snap[series];
    if (data) write(`${series}.json`, { data, fetchedAt: snap.snapshotAt, stale: false, sources: data.sources ?? [], errors: [] });
  }
});

await step('calendrier', async () => {
  const r = await sportCalendar();
  // Une discipline manquante (F1 injoignable) : la version publiée complète est préférable.
  if (r.errors.length && await republish('calendar.json')) return;
  write('calendar.json', { data: r.events, fetchedAt: r.fetchedAt, stale: r.stale, sources: [F1_SOURCE], errors: r.errors });
}, async () => { await republish('calendar.json'); });

// ---------- Alertes : changements par rapport à la version en ligne ----------
let added: AppEvent[] = [];
await step('alertes', async () => {
  const now = new Date().toISOString();
  const cat = fresh.get('catalog.json') as CatalogFile | undefined;
  const f1 = fresh.get('f1.json') as Envelope<F1Overview> | undefined;
  const wec = fresh.get('wec.json') as Envelope<WecSeason> | undefined;
  const wrc = fresh.get('wrc.json') as Envelope<WrcSeason> | undefined;
  const detected: AppEvent[] = [
    ...(cat ? releaseEvents((await fetchPublished<CatalogFile>('catalog.json'))?.generations ?? null, cat.generations, cat.brands, now) : []),
    ...(f1 ? f1Events((await fetchPublished<Envelope<F1Overview>>('f1.json'))?.data ?? null, f1.data, now) : []),
    ...(wec ? wecEvents((await fetchPublished<Envelope<WecSeason>>('wec.json'))?.data ?? null, wec.data, now) : []),
    ...(wrc ? wrcEvents((await fetchPublished<Envelope<WrcSeason>>('wrc.json'))?.data ?? null, wrc.data, now) : []),
  ];
  const history = (await fetchPublished<{ events: AppEvent[] }>('events.json'))?.events ?? [];
  const merged = mergeEvents(history, detected);
  added = merged.added;
  write('events.json', { updatedAt: now, events: merged.all });
  console.log(`  ${added.length} nouvelle(s) alerte(s)`);
});
if (process.env.NEW_EVENTS_FILE) writeFileSync(process.env.NEW_EVENTS_FILE, JSON.stringify(added));

write('build.json', { builtAt: new Date().toISOString(), steps: report });
const failed = Object.entries(report).filter(([, v]) => v !== 'ok');
console.log(failed.length ? `[export] terminé avec ${failed.length} étape(s) en échec` : '[export] terminé');
// Le catalogue est indispensable ; les autres sources peuvent manquer ponctuellement.
if (report.catalogue !== 'ok') process.exit(1);
