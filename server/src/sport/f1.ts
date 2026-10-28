/**
 * Formule 1 — API Jolpica-F1 (https://github.com/jolpica/jolpica-f1), successeur libre d'Ergast.
 * Données publiées après chaque séance (pas de chronométrage en direct) : l'interface
 * n'affiche donc jamais de « direct », uniquement des résultats officiels classés.
 * Limites : ~4 req/s et 500 req/h → cache SQLite systématique.
 */
import type {
  F1ConstructorStanding, F1DriverStanding, F1Overview, F1QualifyingRow, F1Race, F1ResultRow, F1RoundDetail,
} from '../../../shared/sport.ts';
import { cached, type Cached } from '../lib/cache.ts';
import { fetchJson } from '../lib/http.ts';

const BASE = 'https://api.jolpi.ca/ergast/f1';
export const F1_SOURCE = { label: 'Jolpica-F1 (données Ergast)', url: 'https://api.jolpi.ca/ergast/' };

type J = Record<string, any>;

const get = (path: string) => fetchJson<{ MRData: J }>(`${BASE}/${path}`, 'Jolpica-F1').then((r) => r.MRData);

const RACE_DURATION_MS = 3 * 3600 * 1000;

function toUtc(date?: string, time?: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time.endsWith('Z') ? time : `${time}Z`}` : date;
}

function mapRace(r: J, completedRounds: Set<number>, now = Date.now()): F1Race {
  const round = Number(r.round);
  const dateUtc = toUtc(r.date, r.time)!;
  const sessionDefs: Array<[string, string]> = [
    ['FirstPractice', 'Essais libres 1'], ['SecondPractice', 'Essais libres 2'], ['ThirdPractice', 'Essais libres 3'],
    ['SprintQualifying', 'Qualifications sprint'], ['SprintShootout', 'Qualifications sprint'], ['Sprint', 'Course sprint'],
    ['Qualifying', 'Qualifications'],
  ];
  const sessions = sessionDefs
    .filter(([k]) => r[k]?.date && r[k]?.time)
    .map(([k, name]) => ({ name, startUtc: toUtc(r[k].date, r[k].time)! }));
  if (r.time) sessions.push({ name: 'Course', startUtc: dateUtc });
  sessions.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const start = Date.parse(dateUtc);
  const status: F1Race['status'] = completedRounds.has(round) ? 'completed'
    : r.time && now >= start && now <= start + RACE_DURATION_MS ? 'live' : 'upcoming';
  return {
    season: Number(r.season),
    round,
    name: r.raceName,
    circuit: r.Circuit?.circuitName ?? '',
    locality: r.Circuit?.Location?.locality ?? '',
    country: r.Circuit?.Location?.country ?? '',
    dateUtc,
    hasTime: !!r.time,
    sessions,
    hasSprint: !!r.Sprint,
    status,
    wikipedia: r.url ?? null,
  };
}

const driverOf = (d: J): F1ResultRow['driver'] => ({
  id: d.driverId,
  code: d.code ?? null,
  name: `${d.givenName} ${d.familyName}`,
  number: d.permanentNumber ?? null,
  nationality: d.nationality ?? '',
});

const num = (x: unknown) => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x));

function mapResult(x: J): F1ResultRow {
  return {
    position: num(x.position),
    positionText: x.positionText,
    driver: driverOf(x.Driver),
    team: { id: x.Constructor.constructorId, name: x.Constructor.name },
    grid: num(x.grid),
    laps: num(x.laps),
    status: x.status,
    time: x.Time?.time ?? null,
    points: Number(x.points ?? 0),
    fastestLap: x.FastestLap?.rank === '1',
  };
}

async function schedule(season: string): Promise<Cached<J[]>> {
  return cached(`f1:schedule:${season}`, 6 * 3600 * 1000, async () => (await get(`${season}.json?limit=100`)).RaceTable.Races);
}

/** Rounds dont les résultats de course officiels sont publiés. */
async function completedRounds(season: string): Promise<Cached<number[]>> {
  return cached(`f1:completed:${season}`, 15 * 60 * 1000, async () => {
    // La dernière course classée suffit : les manches sont disputées dans l'ordre.
    const last = (await get(`${season}/last/results.json?limit=1`)).RaceTable.Races[0];
    const lastRound = last ? Number(last.round) : 0;
    return Array.from({ length: lastRound }, (_, i) => i + 1);
  });
}

export async function f1Overview(seasonParam = 'current'): Promise<Cached<F1Overview>> {
  const sched = await schedule(seasonParam);
  const season = sched.data[0]?.season ?? seasonParam;
  const [done, drivers, constructors] = await Promise.all([
    completedRounds(season),
    cached(`f1:drivers:${season}`, 30 * 60 * 1000, async () => (await get(`${season}/driverstandings.json`)).StandingsTable),
    cached(`f1:constructors:${season}`, 30 * 60 * 1000, async () => (await get(`${season}/constructorstandings.json`)).StandingsTable),
  ]);
  const doneSet = new Set(done.data);
  const races = sched.data.map((r) => mapRace(r, doneSet));
  const lastRound = done.data.at(-1);
  let lastRace: F1Overview['lastRace'] = null;
  if (lastRound) {
    const res = await roundResults(season, lastRound);
    const race = races.find((r) => r.round === lastRound);
    if (race && res.data) lastRace = { race, results: res.data };
  }
  const dl = drivers.data.StandingsLists?.[0];
  const cl = constructors.data.StandingsLists?.[0];
  const all = [sched, done, drivers, constructors];
  return {
    data: {
      season: Number(season),
      schedule: races,
      lastRace,
      nextRace: races.find((r) => r.status !== 'completed') ?? null,
      drivers: dl ? {
        afterRound: Number(dl.round),
        list: dl.DriverStandings.map((s: J): F1DriverStanding => ({
          position: Number(s.position ?? s.positionText), points: Number(s.points), wins: Number(s.wins),
          driver: driverOf(s.Driver), teams: s.Constructors.map((c: J) => ({ id: c.constructorId, name: c.name })),
        })),
      } : null,
      constructors: cl ? {
        afterRound: Number(cl.round),
        list: cl.ConstructorStandings.map((s: J): F1ConstructorStanding => ({
          position: Number(s.position ?? s.positionText), points: Number(s.points), wins: Number(s.wins),
          team: { id: s.Constructor.constructorId, name: s.Constructor.name, nationality: s.Constructor.nationality },
        })),
      } : null,
    },
    fetchedAt: all.map((c) => c.fetchedAt).sort()[0],
    stale: all.some((c) => c.stale),
    error: all.map((c) => c.error).filter(Boolean).join(' ; ') || undefined,
  };
}

function roundResults(season: string, round: number) {
  return cached(`f1:results:${season}:${round}`, 6 * 3600 * 1000, async () => {
    const races = (await get(`${season}/${round}/results.json`)).RaceTable.Races;
    return races[0] ? (races[0].Results as J[]).map(mapResult) : null;
  });
}

export async function f1Round(season: string, round: number): Promise<Cached<F1RoundDetail | null>> {
  const sched = await schedule(season);
  const done = await completedRounds(season);
  const raw = sched.data.find((r) => Number(r.round) === round);
  if (!raw) return { ...sched, data: null };
  const race = mapRace(raw, new Set(done.data));
  const [results, qualifying, sprint] = await Promise.all([
    race.status === 'completed' ? roundResults(season, round) : Promise.resolve(null),
    cached(`f1:quali:${season}:${round}`, 30 * 60 * 1000, async () => {
      const r = (await get(`${season}/${round}/qualifying.json`)).RaceTable.Races[0];
      return r ? (r.QualifyingResults as J[]).map((q): F1QualifyingRow => ({
        position: Number(q.position), driver: driverOf(q.Driver),
        team: { id: q.Constructor.constructorId, name: q.Constructor.name },
        q1: q.Q1 ?? null, q2: q.Q2 ?? null, q3: q.Q3 ?? null,
      })) : null;
    }),
    race.hasSprint
      ? cached(`f1:sprint:${season}:${round}`, 30 * 60 * 1000, async () => {
        const r = (await get(`${season}/${round}/sprint.json`)).RaceTable.Races[0];
        return r ? (r.SprintResults as J[]).map(mapResult) : null;
      })
      : Promise.resolve(null),
  ]);
  const parts: Array<Pick<Cached<unknown>, 'fetchedAt' | 'stale'>> = [sched, done, qualifying, ...(results ? [results] : []), ...(sprint ? [sprint] : [])];
  return {
    data: { race, results: results?.data ?? null, qualifying: qualifying.data, sprint: sprint?.data ?? null },
    fetchedAt: parts.map((c) => c.fetchedAt).sort()[0],
    stale: parts.some((c) => c.stale),
  };
}
