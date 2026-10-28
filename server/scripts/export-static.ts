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
import { catalog, loadCatalog, resolvedImages, warmImages } from '../src/catalog/store.ts';
import { newsFeed } from '../src/news/aggregate.ts';
import { NEWS_SCOPES } from '../../shared/query-params.ts';
import { f1Overview, f1Round, F1_SOURCE } from '../src/sport/f1.ts';
import { loadSnapshot } from '../src/sport/snapshot.ts';
import { sportCalendar } from '../src/sport/calendar.ts';

const out = path.resolve(process.argv[2] ?? path.join('..', 'web', 'public', 'data'));
mkdirSync(out, { recursive: true });

const write = (name: string, data: unknown) => {
  writeFileSync(path.join(out, name), JSON.stringify(data));
  console.log(`  ✓ ${name}`);
};

const report: Record<string, string> = {};
async function step(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    report[name] = 'ok';
  } catch (e) {
    report[name] = e instanceof Error ? e.message : String(e);
    console.warn(`  ✗ ${name} : ${report[name]}`);
  }
}

console.log(`[export] vers ${out}`);

await step('catalogue', async () => {
  loadCatalog();
  await warmImages();
  const { brands, generations, warnings } = catalog();
  const images: Record<string, ResolvedImage[]> = {};
  for (const g of generations.values()) images[g.id] = resolvedImages(g);
  if (warnings.length) console.warn(`  ! ${warnings.length} avertissement(s) de validation`);
  write('catalog.json', { brands: [...brands.values()], generations: [...generations.values()], images });
});

for (const scope of NEWS_SCOPES) {
  await step(`actualite-${scope}`, async () => write(`news-${scope}.json`, await newsFeed(scope)));
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
  write('calendar.json', { data: r.events, fetchedAt: r.fetchedAt, stale: r.stale, sources: [F1_SOURCE], errors: r.errors });
});

write('build.json', { builtAt: new Date().toISOString(), steps: report });
const failed = Object.entries(report).filter(([, v]) => v !== 'ok');
console.log(failed.length ? `[export] terminé avec ${failed.length} étape(s) en échec` : '[export] terminé');
// Le catalogue est indispensable ; les autres sources peuvent manquer ponctuellement.
if (report.catalogue !== 'ok') process.exit(1);
