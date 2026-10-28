/** Actualité automobile et sport automobile. */
import { Hono } from 'hono';
import { filterNews, newsScopeOf } from '../../../shared/query-params.ts';
import { newsFeed } from '../news/aggregate.ts';
import { f1Overview, f1Round, F1_SOURCE } from '../sport/f1.ts';
import { loadSnapshot } from '../sport/snapshot.ts';
import { sportCalendar } from '../sport/calendar.ts';

export const contentRoutes = new Hono();

// Les alertes sont calculées à la publication (scripts/export-static.ts) par comparaison avec la
// version en ligne ; en développement local, il n'y a pas de version de référence.
contentRoutes.get('/events', (c) => c.json({ updatedAt: null, events: [] }));

contentRoutes.get('/news', async (c) => {
  const q = c.req.query();
  const { items, ...rest } = await newsFeed(newsScopeOf(q.scope));
  return c.json({ ...rest, data: filterNews(items, q) });
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
