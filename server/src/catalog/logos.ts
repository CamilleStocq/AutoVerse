/**
 * Logos des marques : fichier « logo » (P154) de la marque sur Wikidata, image hébergée sur
 * Wikimedia Commons (auteur et licence conservés). Les photos de voitures parfois rattachées à
 * P154 sont écartées ; sans logo fiable, l'interface affiche un monogramme aux couleurs de la marque.
 */
import type { Brand } from '../../../shared/types.ts';
import { cached } from '../lib/cache.ts';
import { fetchJson } from '../lib/http.ts';
import { getCachedImage, normalizeFileTitle, resolveCommonsImages } from './images.ts';

type Binding = { item: { value: string }; logo: { value: string } };

/** Note un fichier candidat : SVG « logo » d'abord, jamais une photo. */
function score(file: string): number {
  const f = file.toLowerCase();
  const looksLikeLogo = /logo|crest|wordmark|emblem|badge|mark|insignia|\.svg$/.test(f);
  if (!looksLikeLogo) return -1;
  return (f.endsWith('.svg') ? 4 : 0) + (/logo/.test(f) ? 2 : 0) + (/group|agriculture|canada|film/.test(f) ? -3 : 0);
}

async function logoFiles(ids: string[]): Promise<Record<string, string>> {
  const query = `SELECT ?item ?logo WHERE { VALUES ?item { ${ids.map((id) => `wd:${id}`).join(' ')} } ?item wdt:P154 ?logo . }`;
  const r = await cached(`wikidata:logos:${ids.join(',')}`, 30 * 24 * 3600 * 1000, async () => {
    const json = await fetchJson<{ results: { bindings: Binding[] } }>(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      'Wikidata',
      30_000,
    );
    const best: Record<string, { file: string; score: number }> = {};
    for (const b of json.results.bindings) {
      const id = b.item.value.split('/').pop()!;
      const file = decodeURIComponent(b.logo.value.split('/').pop()!.replace(/_/g, ' '));
      const s = score(file);
      if (s >= 0 && (!best[id] || s > best[id].score)) best[id] = { file, score: s };
    }
    return Object.fromEntries(Object.entries(best).map(([id, v]) => [id, `File:${v.file}`]));
  });
  return r.data;
}

/** Complète `brand.logo` pour les marques ayant un identifiant Wikidata (silencieux en cas d'échec). */
export async function resolveBrandLogos(brands: Iterable<Brand>): Promise<void> {
  const list = [...brands].filter((b) => b.wikidataId);
  if (!list.length) return;
  let files: Record<string, string>;
  try {
    files = await logoFiles(list.map((b) => b.wikidataId!).sort());
  } catch (e) {
    console.warn('[logos]', e instanceof Error ? e.message : e);
    return;
  }
  await resolveCommonsImages(Object.values(files));
  for (const b of list) {
    const file = files[b.wikidataId!];
    const img = file ? getCachedImage(normalizeFileTitle(file)) : null;
    b.logo = img
      ? { src: img.src.replace(/\/\d+px-/, '/250px-'), author: img.author, license: img.license, pageUrl: img.pageUrl }
      : null;
  }
}
