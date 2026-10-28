/** Actualité automobile et sport automobile. */
import { Hono } from 'hono';
import type { NewsCategory, NewsItem, SourcedPayload } from '../../../shared/api.ts';
import { loadNews } from '../news/aggregate.ts';
import { FEEDS } from '../news/sources.ts';
import { f1Overview, f1Round, F1_SOURCE } from '../sport/f1.ts';
import { loadSnapshot } from '../sport/snapshot.ts';
import { sportCalendar } from '../sport/calendar.ts';

const list = (v: string | undefined) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export const contentRoutes = new Hono();

contentRoutes.get('/news', async (c) => {
  const q = c.req.query();
  const scope = (['auto', 'f1', 'wec', 'wrc'] as const).find((s) => s === q.scope) ?? 'auto';
  const { items, feeds, fetchedAt, stale } = await loadNews(scope);
  const brands = list(q.brands);
  const categories = list(q.categories) as NewsCategory[];
  const prefBrands = list(q.pb);
  const search = q.q?.toLowerCase().trim();
  let filtered = items.filter((n) =>
    (!brands.length || n.brands.some((b) => brands.includes(b)))
    && (!categories.length || n.categories.some((cat) => categories.includes(cat)))
    && (!search || `${n.title} ${n.summary}`.toLowerCase().includes(search)));
  if (prefBrands.length && q.personal === '1') {
    // Priorité (sans exclusion) aux marques suivies, puis récence.
    const now = Date.now();
    filtered = filtered
      .map((n) => {
        const ageH = (now - Date.parse(n.publishedAt)) / 3.6e6;
        const relevance = (n.brands.some((b) => prefBrands.includes(b)) ? 48 : 0) + (n.source.type === 'manufacturer' ? 6 : 0) - ageH;
        return { ...n, relevance };
      })
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
  }
  const pageSize = Math.min(Number(q.pageSize) || 20, 60);
  const page = Math.max(Number(q.page) || 1, 1);
  const payload: SourcedPayload<{ items: NewsItem[]; total: number; page: number; pageSize: number }> & { feeds: typeof feeds } = {
    data: { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize },
    fetchedAt,
    stale,
    sources: FEEDS.filter((f) => f.scope === scope).map((f) => ({ label: f.name, url: f.homepage })),
    errors: feeds.filter((f) => !f.ok).map((f) => `${f.name} : ${f.stale ? 'copie en cache servie' : 'indisponible'}${f.error ? ` (${f.error})` : ''}`),
    feeds,
  };
  return c.json(payload);
});

contentRoutes.get('/sport/f1', async (c) => {
  try {
    const r = await f1Overview(c.req.query('season') ?? 'current');
    return c.json({ data: r.data, fetchedAt: r.fetchedAt, stale: r.stale, sources: [F1_SOURCE], errors: r.error ? [r.error] : [] });
  } catch (e) {
    return c.json({ error: 'Les données de Formule 1 sont momentanément indisponibles.', detail: e instanceof Error ? e.message : String(e) }, 503);
  }
});

contentRoutes.get('/sport/f1/:season/:round', async (c) => {
  try {
    const r = await f1Round(c.req.param('season'), Number(c.req.param('round')));
    if (!r.data) return c.json({ error: 'Manche introuvable pour cette saison.' }, 404);
    return c.json({ data: r.data, fetchedAt: r.fetchedAt, stale: r.stale, sources: [F1_SOURCE], errors: [] });
  } catch (e) {
    return c.json({ error: 'Les données de cette manche sont momentanément indisponibles.', detail: e instanceof Error ? e.message : String(e) }, 503);
  }
});

contentRoutes.get('/sport/:series{wec|wrc}', (c) => {
  const series = c.req.param('series') as 'wec' | 'wrc';
  const snap = loadSnapshot();
  const data = snap?.[series];
  if (!data) return c.json({ error: 'Les données de ce championnat ne sont pas encore disponibles.' }, 404);
  return c.json({ data, fetchedAt: snap!.snapshotAt, stale: false, sources: data.sources ?? [], errors: [] });
});

contentRoutes.get('/sport/calendar', async (c) => {
  const r = await sportCalendar();
  return c.json({ data: r.events, fetchedAt: r.fetchedAt, stale: r.stale, sources: [F1_SOURCE], errors: r.errors });
});
