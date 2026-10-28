import type { PartialDate } from './types.ts';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Formate une date partielle sans jamais ajouter de précision absente de la source.
 * { year: 2027 } → "2027" ; { year: 2027, half: 'early' } → "début 2027" ;
 * { year: 2027, quarter: 2 } → "2e trimestre 2027" ; { year: 2027, month: 3 } → "mars 2027".
 */
export function formatPartialDate(d: PartialDate | null | undefined): string {
  if (!d) return 'Date inconnue';
  if (d.month && d.day) return `${d.day} ${MONTHS_FR[d.month - 1]} ${d.year}`;
  if (d.month) return `${MONTHS_FR[d.month - 1]} ${d.year}`;
  if (d.quarter) return `${d.quarter === 1 ? '1er' : `${d.quarter}e`} trimestre ${d.year}`;
  if (d.half === 'early') return `début ${d.year}`;
  if (d.half === 'mid') return `mi-${d.year}`;
  if (d.half === 'late') return `fin ${d.year}`;
  return String(d.year);
}

/** Intervalle [début, fin] couvert par une date partielle (bornes UTC incluses). */
export function partialDateRange(d: PartialDate): { start: Date; end: Date } {
  const utc = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
  const endOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
  if (d.month && d.day) {
    return { start: utc(d.year, d.month - 1, d.day), end: new Date(Date.UTC(d.year, d.month - 1, d.day, 23, 59, 59)) };
  }
  if (d.month) return { start: utc(d.year, d.month - 1, 1), end: endOfMonth(d.year, d.month - 1) };
  if (d.quarter) {
    const m = (d.quarter - 1) * 3;
    return { start: utc(d.year, m, 1), end: endOfMonth(d.year, m + 2) };
  }
  if (d.half === 'early') return { start: utc(d.year, 0, 1), end: endOfMonth(d.year, 3) };
  if (d.half === 'mid') return { start: utc(d.year, 4, 1), end: endOfMonth(d.year, 7) };
  if (d.half === 'late') return { start: utc(d.year, 8, 1), end: endOfMonth(d.year, 11) };
  return { start: utc(d.year, 0, 1), end: endOfMonth(d.year, 11) };
}

/** Tri chronologique : la date la plus tôt possible d'abord, les dates inconnues à la fin. */
export function comparePartialDates(a: PartialDate | null | undefined, b: PartialDate | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const ra = partialDateRange(a);
  const rb = partialDateRange(b);
  return ra.start.getTime() - rb.start.getTime() || ra.end.getTime() - rb.end.getTime();
}

export type ReleaseWindow = 'past' | 'soon' | '3m' | '6m' | '12m' | 'later' | 'unknown';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Classe une date partielle dans une fenêtre temporelle à partir de `now`.
 * Une date n'entre dans une fenêtre que si TOUT son intervalle y est contenu :
 * « 2027 » n'est donc jamais présenté comme « dans les 3 prochains mois ».
 */
export function releaseWindow(d: PartialDate | null | undefined, now: Date = new Date()): ReleaseWindow {
  if (!d) return 'unknown';
  const { end } = partialDateRange(d);
  if (end.getTime() < now.getTime()) return 'past';
  if (end.getTime() <= addMonths(now, 1).getTime()) return 'soon';
  if (end.getTime() <= addMonths(now, 3).getTime()) return '3m';
  if (end.getTime() <= addMonths(now, 6).getTime()) return '6m';
  if (end.getTime() <= addMonths(now, 12).getTime()) return '12m';
  // Intervalle trop large ou trop lointain pour être classé précisément.
  return 'later';
}

/** Ordre d'inclusion cumulatif des fenêtres (« 6 mois » inclut « 3 mois » et « bientôt »). */
export const WINDOW_ORDER: ReleaseWindow[] = ['soon', '3m', '6m', '12m', 'later'];

export function isWithinWindow(w: ReleaseWindow, filter: ReleaseWindow): boolean {
  if (filter === 'unknown') return w === 'unknown';
  const fi = WINDOW_ORDER.indexOf(filter);
  const wi = WINDOW_ORDER.indexOf(w);
  return wi !== -1 && wi <= fi;
}
