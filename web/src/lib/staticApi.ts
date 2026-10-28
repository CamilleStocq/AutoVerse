/**
 * Mode « application hébergée sans serveur » (GitHub Pages) : répond aux mêmes routes que l'API
 * à partir des fichiers JSON publiés dans /data (régénérés par GitHub Actions), en exécutant
 * dans le navigateur le même moteur de catalogue que le serveur.
 */
import type { NewsItem, ResolvedImage } from '@shared/api';
import type { Brand, Generation } from '@shared/types';
import { carDetail, catalogMeta, queryCars, type CatalogContext } from '@shared/catalog-engine';
import { carQueryFromParams, filterNews, marketOf, newsScopeOf } from '@shared/query-params';
import { ApiError } from './api';

export const IS_STATIC = import.meta.env.VITE_STATIC === '1';

const cache = new Map<string, Promise<unknown>>();

function loadData<T>(name: string): Promise<T> {
  let p = cache.get(name) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${name}`)
      .catch(() => { throw new ApiError('Connexion impossible. Les dernières données consultées restent disponibles hors ligne.', 0); })
      .then((res) => {
        if (res.status === 404) throw new ApiError('Ces données ne sont pas encore disponibles.', 404);
        if (!res.ok) throw new ApiError(`Données momentanément indisponibles (${res.status}).`, res.status);
        return res.json() as Promise<T>;
      });
    p.catch(() => cache.delete(name)); // une erreur ne reste pas en cache
    cache.set(name, p);
  }
  return p;
}

interface CatalogFile { brands: Brand[]; generations: Generation[]; images: Record<string, ResolvedImage[]> }

let ctxPromise: Promise<CatalogContext> | null = null;
function context(): Promise<CatalogContext> {
  ctxPromise ??= loadData<CatalogFile>('catalog.json').then((d) => ({
    brands: new Map(d.brands.map((b) => [b.id, b])),
    generations: new Map(d.generations.map((g) => [g.id, g])),
    imagesFor: (g: Generation) => d.images[g.id] ?? [],
  }));
  ctxPromise.catch(() => { ctxPromise = null; });
  return ctxPromise;
}

type NewsFile = { items: NewsItem[] } & Record<string, unknown>;

/** Équivalent statique de GET /api{path}?{query}. */
export async function staticGet(pathWithQuery: string): Promise<unknown> {
  const url = new URL(pathWithQuery, 'http://local');
  const q = Object.fromEntries(url.searchParams.entries());
  const parts = url.pathname.split('/').filter(Boolean);

  if (url.pathname === '/meta') return catalogMeta(await context());
  if (url.pathname === '/cars') return queryCars(await context(), carQueryFromParams(q));
  if (parts[0] === 'cars' && parts[1]) {
    const detail = carDetail(await context(), decodeURIComponent(parts[1]), marketOf(q.market));
    if (!detail) throw new ApiError('Cette fiche n’existe pas ou a été retirée du catalogue.', 404);
    return detail;
  }
  if (url.pathname === '/news') {
    const { items, ...rest } = await loadData<NewsFile>(`news-${newsScopeOf(q.scope)}.json`);
    return { ...rest, data: filterNews(items, q) };
  }
  if (url.pathname === '/sport/f1') return loadData('f1.json');
  if (parts[0] === 'sport' && parts[1] === 'f1' && parts[3]) {
    return loadData(`f1-${parts[2]}-${parts[3]}.json`).catch((e) => {
      throw e instanceof ApiError && e.status === 404 ? new ApiError('Le détail de cette manche sera publié après la séance.', 404) : e;
    });
  }
  if (url.pathname === '/sport/wec') return loadData('wec.json');
  if (url.pathname === '/sport/wrc') return loadData('wrc.json');
  if (url.pathname === '/sport/calendar') return loadData('calendar.json');
  throw new ApiError('Fonction indisponible dans la version en ligne.', 404);
}
