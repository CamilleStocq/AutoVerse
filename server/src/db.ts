import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  if (config.dbPath !== ':memory:') mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      profile_id TEXT NOT NULL,
      generation_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      -- Instantané de la carte au moment de l'ajout : l'historique survit
      -- à un changement de génération ou au retrait d'une fiche.
      snapshot TEXT NOT NULL,
      PRIMARY KEY (profile_id, generation_id)
    );
    CREATE TABLE IF NOT EXISTS http_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  return db;
}
