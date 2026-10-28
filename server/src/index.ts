import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'node:path';
import { config } from './config.ts';
import { createApp } from './app.ts';
import { loadCatalog, warmImages, watchSeeds } from './catalog/store.ts';

loadCatalog();
const app = createApp();

// En production, l'API sert aussi le frontend compilé (web/dist) avec repli SPA.
if (existsSync(config.webDist)) {
  const root = path.relative(process.cwd(), config.webDist);
  app.use('/assets/*', serveStatic({ root }));
  app.use('*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

const warm = () => warmImages().catch((e) => console.warn('[images] préchargement interrompu :', e));
warm();
watchSeeds(warm);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[autoverse] API prête sur http://localhost:${info.port}/api`);
});
