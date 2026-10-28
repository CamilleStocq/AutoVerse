/**
 * Questionnaires F1 / WEC / WRC générés à partir des vraies données de l'application
 * (classements, résultats, calendriers). Aucune question inventée : chaque réponse provient
 * des données publiées, et les mauvaises réponses proposées sont d'autres valeurs du même type.
 */
import type { F1Overview, WecSeason, WrcSeason } from '@shared/sport';

export type QuizDiscipline = 'f1' | 'wec' | 'wrc';

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
}

export const QUIZ_LENGTH = 5;
/** Seul un sans-faute rapporte un booster bonus. */
export const QUIZ_PASS = QUIZ_LENGTH;

function shuffle<T>(list: T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Question à 4 choix ; ignorée s'il n'existe pas 3 mauvaises réponses distinctes. */
function mcq(id: string, prompt: string, answer: string | number | null | undefined, candidates: Array<string | number | null | undefined>, rng: () => number): QuizQuestion | null {
  if (answer == null || answer === '') return null;
  const a = String(answer);
  const wrong = shuffle([...new Set(candidates.filter((c) => c != null && c !== '').map(String))].filter((c) => c !== a), rng).slice(0, 3);
  if (wrong.length < 3) return null;
  return { id, prompt, answer: a, options: shuffle([a, ...wrong], rng) };
}

/** Pays du calendrier F1 (fournis en anglais par l'API) en français. */
const F1_COUNTRIES: Record<string, string> = {
  Australia: 'Australie', China: 'Chine', Japan: 'Japon', Bahrain: 'Bahreïn', 'Saudi Arabia': 'Arabie saoudite',
  USA: 'États-Unis', 'United States': 'États-Unis', Italy: 'Italie', Monaco: 'Monaco', Spain: 'Espagne', Canada: 'Canada',
  Austria: 'Autriche', UK: 'Royaume-Uni', 'United Kingdom': 'Royaume-Uni', Belgium: 'Belgique', Hungary: 'Hongrie',
  Netherlands: 'Pays-Bas', Azerbaijan: 'Azerbaïdjan', Singapore: 'Singapour', Mexico: 'Mexique', Brazil: 'Brésil',
  Qatar: 'Qatar', UAE: 'Émirats arabes unis', 'United Arab Emirates': 'Émirats arabes unis', Portugal: 'Portugal',
  Germany: 'Allemagne', France: 'France', Malaysia: 'Malaisie', Turkey: 'Turquie', Russia: 'Russie', Vietnam: 'Viêt Nam',
};
const fr = (country: string) => F1_COUNTRIES[country] ?? country;

function f1Questions(d: F1Overview, rng: () => number): Array<QuizQuestion | null> {
  const qs: Array<QuizQuestion | null> = [];
  const drivers = d.drivers?.list ?? [];
  const teams = d.constructors?.list ?? [];
  const after = d.drivers ? ` (après la manche ${d.drivers.afterRound})` : '';
  const driverNames = drivers.map((s) => s.driver.name);
  const teamNames = teams.map((s) => s.team.name);
  if (drivers[0]) qs.push(mcq('f1-leader', `Qui mène le championnat du monde des pilotes ${d.season}${after} ?`, drivers[0].driver.name, driverNames.slice(1, 8), rng));
  if (teams[0]) qs.push(mcq('f1-team-leader', `Quelle écurie mène le championnat des constructeurs ${d.season} ?`, teams[0].team.name, teamNames.slice(1), rng));
  if (d.lastRace) {
    const winner = d.lastRace.results.find((r) => r.position === 1);
    qs.push(mcq('f1-last-winner', `Qui a remporté le ${d.lastRace.race.name} ${d.season} ?`, winner?.driver.name, d.lastRace.results.slice(1, 10).map((r) => r.driver.name), rng));
  }
  for (const s of shuffle(drivers.slice(0, 12), rng).slice(0, 3)) {
    qs.push(mcq(`f1-team-${s.driver.id}`, `Pour quelle écurie court ${s.driver.name} en ${d.season} ?`, s.teams.at(-1)?.name, teamNames, rng));
    qs.push(mcq(`f1-points-${s.driver.id}`, `Combien de points compte ${s.driver.name} au championnat${after} ?`, s.points, drivers.filter((o) => o !== s).map((o) => o.points), rng));
  }
  const completed = d.schedule.filter((r) => r.status === 'completed' || r.status === 'upcoming');
  for (const r of shuffle(completed, rng).slice(0, 2)) {
    qs.push(mcq(`f1-country-${r.round}`, `Dans quel pays se dispute le ${r.name} ?`, fr(r.country), d.schedule.map((x) => fr(x.country)), rng));
  }
  return qs;
}

function wecQuestions(d: WecSeason, rng: () => number): Array<QuizQuestion | null> {
  const qs: Array<QuizQuestion | null> = [];
  const className = (id: string) => d.classes.find((c) => c.id === id)?.name ?? id;
  const allTeams = d.events.flatMap((e) => e.results?.flatMap((r) => r.podium.map((p) => p.team)) ?? []);
  for (const e of shuffle(d.events.filter((x) => x.results?.length), rng).slice(0, 3)) {
    const res = e.results![Math.floor(rng() * e.results!.length)];
    const winner = res.podium.find((p) => p.position === 1);
    qs.push(mcq(`wec-win-${e.shortName}-${res.classId}`, `Quelle équipe a remporté la catégorie ${className(res.classId)} aux ${e.name} ${d.season} ?`, winner?.team, allTeams, rng));
  }
  const hyper = d.manufacturers.filter((m) => m.class === 'hypercar');
  for (const m of shuffle(hyper, rng).slice(0, 2)) {
    qs.push(mcq(`wec-car-${m.name}`, `Quelle voiture la marque ${m.name} engage-t-elle en Hypercar en ${d.season} ?`, m.car, hyper.map((x) => x.car), rng));
  }
  for (const e of shuffle(d.events.filter((x) => x.status !== 'cancelled'), rng).slice(0, 2)) {
    qs.push(mcq(`wec-country-${e.shortName}`, `Dans quel pays se disputent les ${e.name} ?`, e.country, d.events.map((x) => x.country), rng));
  }
  const st = d.standings as (WecSeason['standings'] & { hypercarManufacturers?: Array<{ manufacturer: string }> }) | null;
  if (st?.hypercarManufacturers?.[0]) {
    qs.push(mcq('wec-maker-leader', `Quel constructeur mène le championnat Hypercar ${d.season} (après la manche ${st.afterRound}) ?`, st.hypercarManufacturers[0].manufacturer, st.hypercarManufacturers.slice(1).map((m) => m.manufacturer), rng));
  }
  return qs;
}

const SURFACES = ['asphalte', 'terre', 'neige', 'mixte'];

function wrcQuestions(d: WrcSeason, rng: () => number): Array<QuizQuestion | null> {
  const qs: Array<QuizQuestion | null> = [];
  const allDrivers = d.events.flatMap((e) => e.results?.podium.map((p) => p.driver) ?? []).concat(d.standings?.drivers.map((s) => s.driver) ?? []);
  for (const e of shuffle(d.events.filter((x) => x.results), rng).slice(0, 3)) {
    qs.push(mcq(`wrc-win-${e.shortName}`, `Qui a remporté le ${e.name} ${d.season} ?`, e.results!.podium.find((p) => p.position === 1)?.driver, allDrivers, rng));
  }
  const st = d.standings;
  if (st?.drivers[0]) qs.push(mcq('wrc-leader', `Qui est en tête du championnat WRC ${d.season} (après la manche ${st.afterRound}) ?`, st.drivers[0].driver, st.drivers.slice(1).map((s) => s.driver), rng));
  for (const s of shuffle((st?.drivers ?? []).filter((x) => x.coDriver), rng).slice(0, 2)) {
    qs.push(mcq(`wrc-codriver-${s.driver}`, `Qui est le copilote de ${s.driver} en ${d.season} ?`, s.coDriver, (st?.drivers ?? []).map((x) => x.coDriver), rng));
  }
  for (const e of shuffle(d.events.filter((x) => x.status !== 'cancelled' && x.surface && SURFACES.includes(x.surface)), rng).slice(0, 2)) {
    qs.push(mcq(`wrc-surface-${e.shortName}`, `Sur quelle surface se dispute le ${e.name} ?`, e.surface, SURFACES, rng));
  }
  return qs;
}

/** Tire un questionnaire de 5 questions distinctes (null si les données sont insuffisantes). */
export function buildQuiz(
  discipline: QuizDiscipline,
  data: { f1?: F1Overview | null; wec?: WecSeason | null; wrc?: WrcSeason | null },
  rng: () => number = Math.random,
): QuizQuestion[] | null {
  const raw = discipline === 'f1' ? (data.f1 ? f1Questions(data.f1, rng) : [])
    : discipline === 'wec' ? (data.wec ? wecQuestions(data.wec, rng) : [])
      : (data.wrc ? wrcQuestions(data.wrc, rng) : []);
  const unique = [...new Map(raw.filter((q): q is QuizQuestion => !!q).map((q) => [q.prompt, q])).values()];
  if (unique.length < QUIZ_LENGTH) return null;
  return shuffle(unique, rng).slice(0, QUIZ_LENGTH);
}
