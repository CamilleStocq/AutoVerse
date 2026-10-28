/**
 * Chargement et indexation du catalogue.
 *
 * Les fiches proviennent de `data/seed/*.json` (données compilées et sourcées : constructeurs,
 * presse reconnue) et sont enrichies au chargement :
 * - validation stricte (une fiche invalide est écartée, jamais « corrigée » par supposition) ;
 * - catégories de motorisation recalculées à partir des variantes réelles ;
 * - liens de générations vérifiés (pas de comparaison si la génération précédente est inconnue) ;
 * - images résolues auprès de Wikimedia Commons (auteur + licence).
 */
import { readdirSync, readFileSync, watch } from 'node:fs';
import path from 'node:path';
import type { Brand, CategoryId, Generation, MarketCode, Powertrain } from '../../../shared/types.ts';
import type { CarSummary, ResolvedImage } from '../../../shared/api.ts';
import { powertrainsOf, summarize as engineSummarize, type CatalogContext } from '../../../shared/catalog-engine.ts';

export { powertrainsOf, startingPrice } from '../../../shared/catalog-engine.ts';
import { config } from '../config.ts';
import { brandSchema, generationSchema } from './schema.ts';
import { getCachedImage, resolveCommonsImages } from './images.ts';

const POWERTRAIN_CATEGORY: Record<Powertrain, CategoryId> = {
  ev: 'ev', phev: 'phev', hybrid: 'hybrid', petrol: 'ice', diesel: 'ice',
};
const POWERTRAIN_CATEGORIES = new Set<CategoryId>(['ev', 'phev', 'hybrid', 'ice']);

export interface CatalogState {
  brands: Map<string, Brand>;
  generations: Map<string, Generation>;
  warnings: string[];
  loadedAt: string;
}

let state: CatalogState = { brands: new Map(), generations: new Map(), warnings: [], loadedAt: new Date(0).toISOString() };

export const catalog = () => state;

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadCatalog(seedDir = config.seedDir): CatalogState {
  const warnings: string[] = [];
  const brands = new Map<string, Brand>();
  const brandFile = path.join(seedDir, 'brands.json');
  for (const raw of (readJson(brandFile) as { brands: unknown[] }).brands) {
    const parsed = brandSchema.safeParse(raw);
    if (parsed.success) brands.set(parsed.data.id, parsed.data as Brand);
    else warnings.push(`Marque invalide ignorée : ${JSON.stringify(raw).slice(0, 80)}`);
  }

  const generations = new Map<string, Generation>();
  const files = readdirSync(seedDir).filter((f) => /^(catalog-.+|upcoming)\.json$/.test(f)).sort();
  for (const file of files) {
    let content: { generations?: unknown[] };
    try {
      content = readJson(path.join(seedDir, file)) as { generations?: unknown[] };
    } catch (e) {
      warnings.push(`${file} : JSON illisible (${e instanceof Error ? e.message : e}) — fichier ignoré`);
      continue;
    }
    for (const raw of content.generations ?? []) {
      const parsed = generationSchema.safeParse(raw);
      const id = (raw as { id?: string })?.id ?? '?';
      if (!parsed.success) {
        warnings.push(`${file} › ${id} : fiche invalide ignorée (${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ')})`);
        continue;
      }
      const g = parsed.data as unknown as Generation;
      if (!brands.has(g.brandId)) {
        warnings.push(`${file} › ${g.id} : marque inconnue « ${g.brandId} » — fiche ignorée`);
        continue;
      }
      if (generations.has(g.id)) {
        warnings.push(`${file} › ${g.id} : identifiant en double — première occurrence conservée`);
        continue;
      }
      // Catégories de motorisation : toujours dérivées des données, jamais du nom du modèle.
      const derived = powertrainsOf(g).map((p) => POWERTRAIN_CATEGORY[p]);
      g.categories = [...new Set([...g.categories.filter((c) => !POWERTRAIN_CATEGORIES.has(c)), ...derived])];
      generations.set(g.id, g);
    }
  }

  // Cohérence des liens entre générations.
  for (const g of generations.values()) {
    if (g.previousGenerationId && !generations.has(g.previousGenerationId)) {
      // On garde l'identifiant (utile pour l'historique) mais aucune comparaison automatique.
      if (g.changes) warnings.push(`${g.id} : génération précédente « ${g.previousGenerationId} » absente — comparaison désactivée`);
      g.changes = null;
    }
    if (g.changes) {
      const prev = generations.get(g.changes.previousGenerationId);
      const pair = g.changes.comparablePair;
      if (!prev) g.changes = null;
      else if (pair && (!g.variants.some((v) => v.id === pair.currentVariantId) || !prev.variants.some((v) => v.id === pair.previousVariantId))) {
        warnings.push(`${g.id} : paire de variantes comparables introuvable — comparaison chiffrée désactivée`);
        g.changes.comparablePair = null;
      }
    }
    if (g.previousGenerationId) {
      const prev = generations.get(g.previousGenerationId);
      if (prev && !prev.nextGenerationId) prev.nextGenerationId = g.id;
    }
  }

  state = { brands, generations, warnings, loadedAt: new Date().toISOString() };
  for (const w of warnings) console.warn('[catalog]', w);
  console.log(`[catalog] ${generations.size} fiches, ${brands.size} marques chargées depuis ${files.length} fichier(s)`);
  return state;
}

/** Résout toutes les images Commons du catalogue (appel réseau, mis en cache). */
export async function warmImages(): Promise<void> {
  const files = [...state.generations.values()].flatMap((g) => g.images.map((i) => i.commonsFile).filter((f): f is string => !!f));
  await resolveCommonsImages(files);
}

export function resolvedImages(g: Generation): ResolvedImage[] {
  const out: ResolvedImage[] = [];
  for (const img of g.images) {
    const base = { depicts: img.depicts, isOfficial: img.isOfficial, isIllustration: !!img.isIllustration };
    if (img.commonsFile) {
      const r = getCachedImage(img.commonsFile);
      if (r) out.push({ ...base, ...r });
    } else if (img.url) {
      out.push({ ...base, src: img.url, thumb: img.url, width: 0, height: 0, author: null, license: null, licenseUrl: null, pageUrl: null });
    }
  }
  return out;
}

/** Recharge automatiquement les données quand un fichier seed change (débounce 500 ms). */
export function watchSeeds(onReload: () => void): void {
  let timer: NodeJS.Timeout | undefined;
  try {
    watch(config.seedDir, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          loadCatalog();
          onReload();
        } catch (e) {
          console.error('[catalog] rechargement impossible :', e);
        }
      }, 500);
    });
  } catch {
    // fs.watch indisponible (certains systèmes de fichiers) : rechargement au redémarrage seulement.
  }
}

// ---------- Contexte du moteur partagé ----------

/** Contexte courant pour le moteur du catalogue (shared/catalog-engine.ts). */
export function catalogContext(): CatalogContext {
  return { brands: state.brands, generations: state.generations, imagesFor: resolvedImages };
}

export function summarize(g: Generation, market: MarketCode): CarSummary {
  return engineSummarize(catalogContext(), g, market);
}
