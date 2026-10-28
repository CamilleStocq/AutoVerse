/**
 * Export des données en fichiers JSON statiques pour l'application hébergée sans serveur
 * (GitHub Pages). Exécuté par GitHub Actions toutes les 30 minutes :
 *   node --env-file-if-exists=.env scripts/export-static.ts <dossier de sortie>
 *
 * Chaque source est exportée indépendamment : une source en panne n'empêche pas les autres
 * d'être publiées, et le cache SQLite (conservé entre deux exécutions) sert de copie de secours.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ResolvedImage } from '../../shared/api.ts';
import type { F1Overview } from '../../shared/sport.ts';
import { catalog, loadCatalog, resolvedImages, warmImages } from '../src/catalog/store.ts';
import { newsFeed } from '../src/news/aggregate.ts';
import { NEWS_SCOPES } from '../../shared/query-params.ts';
import { f1Overview, f1Round, F1_SOURCE } from '../src/sport/f1.ts';
import { loadSnapshot } from '../src/sport/snapshot.ts';
import { sportCalendar } from '../src/sport/calendar.ts';

const out = path.resolve(process.argv[2] ?? path.join('..', 'web', 'public', 'data'));
mkdirSync(out, { recursive: true });

const written = new Set<string>();
const write = (name: string, data: unknown) => {
  writeFileSync(path.join(out, name), JSON.stringify(data));
  written.add(name);
  console.log(`  ✓ ${name}`);
};

/** Site déjà publié (ex. https://user.github.io/Repo/) : source de repli si une API échoue. */
const PUBLISHED = process.env.PUBLISHED_URL?.replace(/\/?$/, '/');

/** Recopie un fichier de la version en ligne, en le marquant comme copie de secours. */
async function republish(name: string): Promise<unknown | null> {
  if (!PUBLISHED) return null;
  try {
    const res = await fetch(`${PUBLISHED}data/${name}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    // Les enveloppes « sourcées » signalent qu'il s'agit de la dernière copie connue (date conservée).
    const marked = 'fetchedAt' in data ? { ...data, stale: true } : data;
    write(name, marked);
    return marked;
  } catch {
    return null;
  }
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

console.log(`[export] vers ${out}`);

await step('catalogue', async () => {
  loadCatalog();
  await warmImages();
  const { brands, generations, warnings } = catalog();
  const images: Record<string, ResolvedImage[]> = {};
  for (const g of generations.values()) images[g.id] = resolvedImages(g);
  // Wikimedia indisponible : on reprend les photos déjà publiées plutôt que des fiches sans image.
  const missing = [...generations.values()].filter((g) => g.images.some((i) => i.commonsFile) && !images[g.id].length);
  if (missing.length && PUBLISHED) {
    try {
      const res = await fetch(`${PUBLISHED}data/catalog.json`, { signal: AbortSignal.timeout(20_000) });
      const prev = res.ok ? ((await res.json()) as { images?: Record<string, ResolvedImage[]> }).images ?? {} : {};
      let reused = 0;
      for (const g of missing) {
        // Seulement si la photo publiée correspond toujours à la fiche (même description).
        const known = new Set(g.images.map((i) => i.depicts));
        const kept = (prev[g.id] ?? []).filter((i) => known.has(i.depicts));
        if (kept.length) { images[g.id] = kept; reused++; }
      }
      if (reused) console.warn(`  ! ${reused} fiche(s) : photos reprises de la version publiée`);
    } catch {
      // Pas de version publiée accessible : les fiches concernées affichent le visuel neutre.
    }
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
  const prev = written.has('f1.json') ? null : await republish('f1.json');
  const schedule = (prev as { data?: F1Overview } | null)?.data?.schedule ?? [];
  for (const race of schedule) {
    const name = `f1-${race.season}-${race.round}.json`;
    if (race.status !== 'upcoming' && !written.has(name)) await republish(name);
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

write('build.json', { builtAt: new Date().toISOString(), steps: report });
const failed = Object.entries(report).filter(([, v]) => v !== 'ok');
console.log(failed.length ? `[export] terminé avec ${failed.length} étape(s) en échec` : '[export] terminé');
// Le catalogue est indispensable ; les autres sources peuvent manquer ponctuellement.
if (report.catalogue !== 'ok') process.exit(1);
