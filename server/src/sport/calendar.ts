/** Calendrier unifié F1 + WEC + WRC. Les horaires sont en UTC ; le frontend convertit en heure locale. */
import type { SportEvent } from '../../../shared/api.ts';
import { f1Overview, F1_SOURCE } from './f1.ts';
import { loadSnapshot } from './snapshot.ts';

export async function sportCalendar(): Promise<{ events: SportEvent[]; errors: string[]; fetchedAt: string; stale: boolean }> {
  const events: SportEvent[] = [];
  const errors: string[] = [];
  let fetchedAt = new Date().toISOString();
  let stale = false;

  try {
    const f1 = await f1Overview();
    fetchedAt = f1.fetchedAt;
    stale = f1.stale;
    for (const r of f1.data.schedule) {
      const firstSession = r.sessions[0]?.startUtc.slice(0, 10) ?? r.dateUtc.slice(0, 10);
      events.push({
        id: `f1-${r.season}-${r.round}`,
        discipline: 'f1',
        season: r.season,
        round: r.round,
        name: r.name,
        venue: r.circuit,
        country: r.country,
        startDate: firstSession,
        endDate: r.dateUtc.slice(0, 10),
        mainStartUtc: r.hasTime ? r.dateUtc : null,
        sessions: r.sessions,
        status: r.status,
        sourceLabel: F1_SOURCE.label,
        sourceUrl: F1_SOURCE.url,
      });
    }
  } catch (e) {
    errors.push(`Formule 1 : ${e instanceof Error ? e.message : e}`);
  }

  const snap = loadSnapshot();
  if (!snap) errors.push('WEC / WRC : instantané des championnats indisponible');
  // Une épreuve sans dates publiées ne peut pas figurer dans un calendrier.
  for (const e of (snap?.wec?.events ?? []).filter((x) => x.startDate && x.endDate)) {
    events.push({
      id: `wec-${snap!.wec!.season}-${e.round ?? e.shortName}`,
      discipline: 'wec',
      season: snap!.wec!.season,
      round: e.round,
      name: e.name,
      venue: e.circuit,
      country: e.country,
      startDate: e.startDate!,
      endDate: e.endDate!,
      mainStartUtc: e.raceStartUtc,
      sessions: e.raceStartUtc ? [{ name: 'Départ de la course', startUtc: e.raceStartUtc }] : [],
      status: e.status,
      sourceLabel: e.sources[0]?.label ?? 'FIA WEC',
      sourceUrl: e.sources[0]?.url ?? 'https://www.fiawec.com',
    });
  }
  for (const e of (snap?.wrc?.events ?? []).filter((x) => x.startDate && x.endDate)) {
    events.push({
      id: `wrc-${snap!.wrc!.season}-${e.round ?? e.shortName}`,
      discipline: 'wrc',
      season: snap!.wrc!.season,
      round: e.round,
      name: e.name,
      venue: e.base ?? e.shortName,
      country: e.country,
      startDate: e.startDate!,
      endDate: e.endDate!,
      mainStartUtc: null,
      sessions: [],
      status: e.status,
      sourceLabel: e.sources[0]?.label ?? 'WRC',
      sourceUrl: e.sources[0]?.url ?? 'https://www.wrc.com',
    });
  }
  events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.discipline.localeCompare(b.discipline));
  return { events, errors, fetchedAt, stale };
}
