/**
 * WEC et WRC : aucune API officielle ouverte n'existe (le chronométrage Al Kamel et l'API du
 * site wrc.com ne sont ni documentés ni licenciés pour la réutilisation). On sert donc un
 * instantané daté et sourcé (`data/seed/motorsport-2026.json`), compilé à partir des sites
 * officiels des championnats. Le statut des épreuves (à venir / en cours / terminé) est
 * recalculé à chaque requête à partir des dates ; un résultat n'est affiché que s'il figure
 * dans l'instantané — jamais déduit.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { MotorsportSnapshot, WecEvent, WrcEvent } from '../../../shared/sport.ts';
import { config } from '../config.ts';

let cache: { file: string; mtime: number; data: MotorsportSnapshot } | null = null;

export function eventStatus(
  e: { startDate: string | null; endDate: string | null; status: string },
  now = new Date(),
): 'upcoming' | 'live' | 'completed' | 'cancelled' {
  if (e.status === 'cancelled') return 'cancelled';
  if (!e.startDate || !e.endDate) return 'upcoming'; // dates non publiées : jamais présumée terminée
  const today = now.toISOString().slice(0, 10);
  if (today < e.startDate) return 'upcoming';
  if (today <= e.endDate) return 'live';
  return 'completed';
}

export function loadSnapshot(now = new Date(), seedDir = config.seedDir): MotorsportSnapshot | null {
  const file = path.join(seedDir, 'motorsport-2026.json');
  try {
    const { mtimeMs } = statSync(file);
    if (!cache || cache.file !== file || cache.mtime !== mtimeMs) {
      cache = { file, mtime: mtimeMs, data: JSON.parse(readFileSync(file, 'utf8')) as MotorsportSnapshot };
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[sport] instantané WEC/WRC illisible :', e instanceof Error ? e.message : e);
    }
    return null;
  }
  const snap = structuredClone(cache.data);
  const fix = <T extends WecEvent | WrcEvent>(ev: T): T => {
    const status = eventStatus(ev, now);
    // Une épreuve passée sans résultat dans l'instantané reste « terminée » sans podium :
    // l'interface renvoie alors vers la source officielle.
    return { ...ev, status, results: status === 'completed' ? ev.results : null };
  };
  if (snap.wec) snap.wec.events = snap.wec.events.map(fix);
  if (snap.wrc) snap.wrc.events = snap.wrc.events.map(fix);
  return snap;
}
