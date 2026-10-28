/**
 * Profil, préférences et wishlist, persistés en SQLite.
 * Application personnelle : un profil est identifié par un UUID généré par l'appareil.
 * Pour synchroniser un second appareil, on y saisit le même identifiant (écran Profil).
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Profile, WishlistEntry } from '../../../shared/profile.ts';
import { DEFAULT_PREFERENCES } from '../../../shared/profile.ts';
import { getDb } from '../db.ts';

const idSchema = z.uuid();

const preferencesSchema = z.object({
  brands: z.union([z.literal('all'), z.array(z.string().max(40)).max(200)]),
  categories: z.array(z.string().max(30)).max(30),
  powertrains: z.array(z.enum(['petrol', 'diesel', 'hybrid', 'phev', 'ev'])),
  priceRanges: z.array(z.enum(['budget', 'mid', 'premium', 'luxury'])),
  periods: z.array(z.enum(['current', 'upcoming', 'classic'])),
  usages: z.array(z.enum(['driving-pleasure', 'daily', 'family', 'travel', 'track', 'collection'])),
  interests: z.array(z.enum(['engines', 'batteries', 'performance', 'tech', 'design'])),
  market: z.enum(['BE', 'FR', 'LU', 'NL', 'DE', 'CH', 'IT', 'ES', 'GB']),
});

const profileBody = z.object({
  onboardedAt: z.string().nullable(),
  preferences: preferencesSchema,
});

const wishlistBody = z.object({
  addedAt: z.string().optional(),
  snapshot: z.looseObject({ id: z.string(), brandName: z.string(), modelName: z.string() }),
});

export const profileRoutes = new Hono();

profileRoutes.use('/profile/:id/*', async (c, next) => {
  if (!idSchema.safeParse(c.req.param('id')).success) return c.json({ error: 'Identifiant de profil invalide.' }, 400);
  await next();
});

profileRoutes.get('/profile/:id', (c) => {
  const id = c.req.param('id');
  if (!idSchema.safeParse(id).success) return c.json({ error: 'Identifiant de profil invalide.' }, 400);
  const row = getDb().prepare('SELECT data, updated_at FROM profiles WHERE id = ?').get(id) as { data: string; updated_at: string } | undefined;
  if (!row) return c.json(null);
  const data = JSON.parse(row.data) as Omit<Profile, 'id' | 'updatedAt'>;
  return c.json({ id, ...data, preferences: { ...DEFAULT_PREFERENCES, ...data.preferences }, updatedAt: row.updated_at } satisfies Profile);
});

profileRoutes.put('/profile/:id', async (c) => {
  const id = c.req.param('id');
  if (!idSchema.safeParse(id).success) return c.json({ error: 'Identifiant de profil invalide.' }, 400);
  const parsed = profileBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Préférences invalides.', issues: parsed.error.issues.slice(0, 5) }, 400);
  const updatedAt = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO profiles (id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(id, JSON.stringify(parsed.data), updatedAt);
  return c.json({ id, ...parsed.data, updatedAt } as Profile);
});

profileRoutes.get('/profile/:id/wishlist', (c) => {
  const rows = getDb().prepare('SELECT generation_id, added_at, snapshot FROM wishlist WHERE profile_id = ? ORDER BY added_at DESC')
    .all(c.req.param('id')) as Array<{ generation_id: string; added_at: string; snapshot: string }>;
  return c.json(rows.map((r): WishlistEntry => ({ generationId: r.generation_id, addedAt: r.added_at, snapshot: JSON.parse(r.snapshot) })));
});

profileRoutes.put('/profile/:id/wishlist/:genId', async (c) => {
  const parsed = wishlistBody.safeParse(await c.req.json().catch(() => null));
  const genId = c.req.param('genId');
  if (!parsed.success || parsed.data.snapshot.id !== genId) return c.json({ error: 'Élément de wishlist invalide.' }, 400);
  const addedAt = parsed.data.addedAt ?? new Date().toISOString();
  getDb().prepare(
    `INSERT INTO wishlist (profile_id, generation_id, added_at, snapshot) VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id, generation_id) DO UPDATE SET snapshot = excluded.snapshot`,
  ).run(c.req.param('id'), genId, addedAt, JSON.stringify(parsed.data.snapshot));
  return c.json({ generationId: genId, addedAt, snapshot: parsed.data.snapshot });
});

profileRoutes.delete('/profile/:id/wishlist/:genId', (c) => {
  getDb().prepare('DELETE FROM wishlist WHERE profile_id = ? AND generation_id = ?').run(c.req.param('id'), c.req.param('genId'));
  return c.body(null, 204);
});
