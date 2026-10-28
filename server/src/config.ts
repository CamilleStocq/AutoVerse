import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: path.join(root, 'data'),
  seedDir: path.join(root, 'data', 'seed'),
  dbPath: process.env.AUTOVERSE_DB ?? path.join(root, 'data', 'runtime', 'autoverse.db'),
  webDist: path.resolve(root, '..', 'web', 'dist'),
  /** Identité HTTP envoyée aux API publiques (Wikimedia l'exige). */
  userAgent: process.env.HTTP_USER_AGENT ?? 'Autoverse/0.1 (application personnelle; contact: voir README)',
  /** Désactive tous les appels réseau sortants (tests, mode hors ligne). */
  offline: process.env.AUTOVERSE_OFFLINE === '1',
};
