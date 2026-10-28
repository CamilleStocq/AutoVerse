import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { catalog } from './catalog/store.ts';
import { catalogRoutes } from './routes/catalog.ts';
import { contentRoutes } from './routes/content.ts';
import { profileRoutes } from './routes/profile.ts';

export function createApp() {
  const app = new Hono();
  const api = new Hono();

  api.use('*', cors({ origin: (o) => (o && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : null) }));
  api.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'Requête trop volumineuse.' }, 413) }));

  api.get('/health', (c) => {
    const { generations, warnings, loadedAt } = catalog();
    return c.json({ ok: true, cars: generations.size, catalogWarnings: warnings, catalogLoadedAt: loadedAt });
  });
  api.route('/', catalogRoutes);
  api.route('/', contentRoutes);
  api.route('/', profileRoutes);

  api.onError((err, c) => {
    console.error('[api]', err);
    return c.json({ error: 'Une erreur inattendue est survenue côté serveur. Réessayez dans un instant.' }, 500);
  });
  api.notFound((c) => c.json({ error: 'Ressource introuvable.' }, 404));

  app.route('/api', api);
  return app;
}
