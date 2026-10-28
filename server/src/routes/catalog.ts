import { Hono } from 'hono';
import { carQueryFromParams, marketOf } from '../../../shared/query-params.ts';
import { catalog } from '../catalog/store.ts';
import { carDetail, catalogMeta, collectibleCards, queryCars } from '../catalog/query.ts';

export const catalogRoutes = new Hono();

catalogRoutes.get('/meta', (c) => c.json({ ...catalogMeta(), warnings: catalog().warnings.length }));

catalogRoutes.get('/cars', (c) => c.json(queryCars(carQueryFromParams(c.req.query()))));

/** Cartes à collectionner : une par version. */
catalogRoutes.get('/cards', (c) => c.json({ items: collectibleCards(marketOf(c.req.query('market'))) }));

catalogRoutes.get('/cars/:id', (c) => {
  const detail = carDetail(c.req.param('id'), marketOf(c.req.query('market')));
  if (!detail) return c.json({ error: 'Cette fiche n’existe pas ou a été retirée du catalogue.' }, 404);
  return c.json(detail);
});
