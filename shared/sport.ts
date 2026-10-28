import type { SportEvent } from './api.ts';

export interface F1Session { name: string; startUtc: string }

export interface F1Race {
  season: number;
  round: number;
  name: string;
  circuit: string;
  locality: string;
  country: string;
  dateUtc: string; // départ de la course (UTC) ou date seule « YYYY-MM-DD »
  hasTime: boolean;
  sessions: F1Session[];
  hasSprint: boolean;
  status: 'upcoming' | 'live' | 'completed';
  wikipedia: string | null;
}

export interface F1ResultRow {
  position: number | null;
  positionText: string; // « R » abandon, « D » disqualifié, etc.
  driver: { id: string; code: string | null; name: string; number: string | null; nationality: string };
  team: { id: string; name: string };
  grid: number | null;
  laps: number | null;
  status: string;
  time: string | null;
  points: number;
  fastestLap?: boolean;
}

export interface F1QualifyingRow {
  position: number;
  driver: F1ResultRow['driver'];
  team: F1ResultRow['team'];
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export interface F1DriverStanding { position: number; points: number; wins: number; driver: F1ResultRow['driver']; teams: Array<{ id: string; name: string }> }
export interface F1ConstructorStanding { position: number; points: number; wins: number; team: { id: string; name: string; nationality: string } }

export interface F1Overview {
  season: number;
  schedule: F1Race[];
  lastRace: { race: F1Race; results: F1ResultRow[] } | null;
  nextRace: F1Race | null;
  drivers: { afterRound: number; list: F1DriverStanding[] } | null;
  constructors: { afterRound: number; list: F1ConstructorStanding[] } | null;
}

export interface F1RoundDetail {
  race: F1Race;
  results: F1ResultRow[] | null;
  qualifying: F1QualifyingRow[] | null;
  sprint: F1ResultRow[] | null;
}

// ---------- WEC / WRC (instantané sourcé) ----------
export interface SnapshotSource { label: string; url: string; type: string; publishedAt?: string | null; retrievedAt: string }

export interface WecPodiumEntry { position: number; carNumber: string | null; team: string; manufacturer: string | null; car: string | null; drivers: string[] }
export interface WecEvent {
  /** null pour une épreuve annulée avant attribution d’un numéro de manche. */
  round: number | null; name: string; shortName: string; circuit: string; country: string; countryCode: string;
  startDate: string | null; endDate: string | null; raceStartUtc: string | null; timezone: string; durationLabel: string | null;
  status: 'completed' | 'cancelled' | 'upcoming' | 'live';
  results: Array<{ classId: string; podium: WecPodiumEntry[] }> | null;
  sources: SnapshotSource[];
}
export interface WecSeason {
  season: number;
  classes: Array<{ id: string; name: string; description: string }>;
  events: WecEvent[];
  standings: Record<string, unknown> & { afterRound: number; asOf: string; sources: SnapshotSource[] } | null;
  manufacturers: Array<{ name: string; car: string; class: string; note?: string | null }>;
  sources: SnapshotSource[];
}

export interface WrcPodiumEntry { position: number; driver: string; coDriver: string | null; team: string | null; car: string | null; time: string | null }
export interface WrcEvent {
  round: number | null; name: string; shortName: string; country: string; countryCode: string; base: string | null;
  startDate: string | null; endDate: string | null; timezone: string; surface: string | null;
  stages: number | null; distanceKm: number | null;
  status: 'completed' | 'cancelled' | 'upcoming' | 'live';
  results: { category: string; podium: WrcPodiumEntry[] } | null;
  sources: SnapshotSource[];
}
export interface WrcSeason {
  season: number;
  categories: Array<{ id: string; name: string; description: string }>;
  events: WrcEvent[];
  standings: {
    afterRound: number; asOf: string;
    drivers: Array<{ position: number; driver: string; coDriver?: string | null; team?: string | null; points: number }>;
    manufacturers: Array<{ position: number; team: string; points: number }>;
    sources: SnapshotSource[];
  } | null;
  teams: Array<{ name: string; car: string; drivers: string[]; note?: string | null }>;
  sources: SnapshotSource[];
}

export interface MotorsportSnapshot {
  snapshotAt: string;
  wec: WecSeason | null;
  wrc: WrcSeason | null;
}

export type { SportEvent };
