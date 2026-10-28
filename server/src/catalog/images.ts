/**
 * Résolution des images Wikimedia Commons (licences libres, auteur et licence affichés).
 * Les métadonnées sont mises en cache 30 jours en SQLite ; en cas d'échec réseau,
 * l'interface affiche un visuel de remplacement plutôt qu'une image erronée.
 */
import { getDb } from '../db.ts';
import { fetchJson, UpstreamError } from '../lib/http.ts';

export interface CommonsImage {
  src: string;
  thumb: string;
  width: number;
  height: number;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  pageUrl: string;
}

const TTL_MS = 30 * 24 * 3600 * 1000;
const NEGATIVE_TTL_MS = 24 * 3600 * 1000;
const memory = new Map<string, CommonsImage | null>();

const stripHtml = (s: string | undefined) =>
  s ? s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null : null;

export const normalizeFileTitle = (f: string) =>
  (f.startsWith('File:') ? f : `File:${f}`).replace(/_/g, ' ').trim();

interface ImageInfoResponse {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    pages?: Record<string, {
      title: string;
      missing?: string;
      imageinfo?: Array<{
        url: string; thumburl?: string; width: number; height: number; descriptionurl: string;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
  };
}

export function getCachedImage(file: string): CommonsImage | null | undefined {
  return memory.get(normalizeFileTitle(file));
}

/** Résout un lot de fichiers Commons (50 par requête, limite de l'API). */
export async function resolveCommonsImages(files: string[]): Promise<void> {
  const db = getDb();
  const titles = [...new Set(files.map(normalizeFileTitle))];
  const missing: string[] = [];
  const read = db.prepare('SELECT value, expires_at FROM http_cache WHERE key = ?');
  for (const t of titles) {
    if (memory.has(t)) continue;
    const row = read.get(`commons:${t}`) as { value: string; expires_at: number } | undefined;
    if (row) memory.set(t, JSON.parse(row.value));
    if (!row || row.expires_at < Date.now()) missing.push(t);
  }
  const write = db.prepare(
    `INSERT INTO http_cache (key, value, fetched_at, expires_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
  );
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=1'
      + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1920'
      + '&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl'
      + `&titles=${encodeURIComponent(batch.join('|'))}`;
    let json: ImageInfoResponse | null = null;
    // Wikimedia limite le débit (HTTP 429) : jusqu'à 3 tentatives avec attente croissante.
    for (let attempt = 0; attempt < 3 && !json; attempt++) {
      try {
        json = await fetchJson<ImageInfoResponse>(url, 'Wikimedia Commons', 20_000);
      } catch (e) {
        const retry = e instanceof UpstreamError && e.status === 429 && attempt < 2;
        if (!retry) console.warn('[images]', e instanceof Error ? e.message : e);
        if (retry) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        else break;
      }
    }
    if (!json) continue; // on garde les copies en cache éventuelles
    const aliases = new Map((json.query?.normalized ?? []).map((n) => [n.to, n.from]));
    const now = new Date().toISOString();
    for (const page of Object.values(json.query?.pages ?? {})) {
      const title = normalizeFileTitle(aliases.get(page.title) ?? page.title);
      const info = page.imageinfo?.[0];
      let value: CommonsImage | null = null;
      if (info && !page.missing) {
        const md = info.extmetadata ?? {};
        value = {
          src: info.thumburl ?? info.url,
          // Wikimedia ne sert que des largeurs de vignettes normalisées (960 px, 1280 px…).
          thumb: (info.thumburl ?? info.url).replace(/\/\d+px-/, '/960px-'),
          width: info.width,
          height: info.height,
          author: stripHtml(md.Artist?.value),
          license: stripHtml(md.LicenseShortName?.value),
          licenseUrl: md.LicenseUrl?.value ?? null,
          pageUrl: info.descriptionurl,
        };
      } else {
        console.warn(`[images] fichier Commons introuvable : ${title}`);
      }
      memory.set(title, value);
      write.run(`commons:${title}`, JSON.stringify(value), now, Date.now() + (value ? TTL_MS : NEGATIVE_TTL_MS));
    }
  }
}
