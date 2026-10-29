/**
 * Questionnaires F1 / WEC / WRC générés à partir des vraies données de l'application
 * (classements, résultats, calendriers, circuits, équipages, et cartes du catalogue).
 * Aucune question inventée : chaque réponse provient des données publiées, et les mauvaises
 * réponses proposées sont d'autres valeurs du même type tirées des mêmes données.
 * Chaque questionnaire mélange les thèmes (pilotes, palmarès, circuits, voitures).
 */
import type { CarSummary } from '@shared/api';
import type { F1Overview, WecSeason, WrcSeason } from '@shared/sport';

export type QuizDiscipline = 'f1' | 'wec' | 'wrc';
export type QuizTheme = 'pilotes' | 'palmares' | 'circuits' | 'voitures';

export interface QuizQuestion {
  id: string;
  theme: QuizTheme;
  prompt: string;
  options: string[];
  answer: string;
}

export const QUIZ_LENGTH = 5;
/** Seul un sans-faute rapporte un booster bonus. */
export const QUIZ_PASS = QUIZ_LENGTH;

export const THEME_LABELS: Record<QuizTheme, string> = {
  pilotes: 'Pilotes',
  palmares: 'Palmarès',
  circuits: 'Circuits',
  voitures: 'Voitures',
};

function shuffle<T>(list: T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Q = QuizQuestion | null;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Vrai si la question contient déjà sa réponse (ex. « circuit de Las Vegas » → « Las Vegas »). */
function gives(prompt: string, answer: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(answer)}($|[^\\p{L}\\p{N}])`, 'iu').test(prompt);
}

/**
 * Question à 4 choix ; ignorée s'il n'existe pas 3 mauvaises réponses distinctes,
 * ou si la question contient sa propre réponse.
 */
function mcq(theme: QuizTheme, id: string, prompt: string, answer: string | number | null | undefined, candidates: Array<string | number | null | undefined>, rng: () => number): Q {
  if (answer == null || answer === '') return null;
  const a = String(answer);
  if (gives(prompt, a)) return null;
  const wrong = shuffle([...new Set(candidates.filter((c) => c != null && c !== '').map(String))].filter((c) => c !== a), rng).slice(0, 3);
  if (wrong.length < 3) return null;
  return { id, theme, prompt, answer: a, options: shuffle([a, ...wrong], rng) };
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

/** Nationalités des pilotes (fournies en anglais) ; une nationalité non traduite n'est jamais posée. */
const NATIONALITIES: Record<string, string> = {
  British: 'Britannique', Dutch: 'Néerlandais', Monegasque: 'Monégasque', Spanish: 'Espagnol', Mexican: 'Mexicain',
  Australian: 'Australien', French: 'Français', German: 'Allemand', Finnish: 'Finlandais', Canadian: 'Canadien',
  Thai: 'Thaïlandais', Japanese: 'Japonais', Chinese: 'Chinois', Danish: 'Danois', American: 'Américain',
  Italian: 'Italien', 'New Zealander': 'Néo-Zélandais', Argentine: 'Argentin', Argentinian: 'Argentin',
  Brazilian: 'Brésilien', Belgian: 'Belge', Swiss: 'Suisse', Austrian: 'Autrichien', Polish: 'Polonais',
};

// ---------- F1 ----------

function f1Questions(d: F1Overview, rng: () => number): Q[] {
  const qs: Q[] = [];
  const drivers = d.drivers?.list ?? [];
  const teams = d.constructors?.list ?? [];
  const after = d.drivers ? ` (après la manche ${d.drivers.afterRound})` : '';
  const driverNames = drivers.map((s) => s.driver.name);
  const teamNames = teams.map((s) => s.team.name);

  // Palmarès
  if (drivers[0]) qs.push(mcq('palmares', 'f1-leader', `Qui mène le championnat du monde des pilotes ${d.season}${after} ?`, drivers[0].driver.name, driverNames.slice(1, 8), rng));
  if (teams[0]) qs.push(mcq('palmares', 'f1-team-leader', `Quelle écurie mène le championnat des constructeurs ${d.season} ?`, teams[0].team.name, teamNames.slice(1), rng));
  if (d.lastRace) {
    const res = d.lastRace.results;
    const name = `${d.lastRace.race.name} ${d.season}`;
    const winner = res.find((r) => r.position === 1);
    qs.push(mcq('palmares', 'f1-last-winner', `Qui a remporté le ${name} ?`, winner?.driver.name, res.slice(1, 10).map((r) => r.driver.name), rng));
    qs.push(mcq('palmares', 'f1-last-second', `Qui a terminé deuxième du ${name} ?`, res.find((r) => r.position === 2)?.driver.name, res.filter((r) => r.position !== 2).slice(0, 10).map((r) => r.driver.name), rng));
    qs.push(mcq('palmares', 'f1-last-team', `Quelle écurie a gagné le ${name} ?`, winner?.team.name, teamNames, rng));
    const fastest = res.find((r) => r.fastestLap);
    if (fastest) qs.push(mcq('palmares', 'f1-fastest', `Qui a signé le meilleur tour du ${name} ?`, fastest.driver.name, res.filter((r) => r !== fastest).slice(0, 10).map((r) => r.driver.name), rng));
  }
  for (const s of shuffle(drivers.slice(0, 12), rng).slice(0, 2)) {
    qs.push(mcq('palmares', `f1-points-${s.driver.id}`, `Combien de points compte ${s.driver.name} au championnat${after} ?`, s.points, drivers.filter((o) => o !== s).map((o) => o.points), rng));
    qs.push(mcq('palmares', `f1-wins-${s.driver.id}`, `Combien de Grands Prix ${s.driver.name} a-t-il gagnés en ${d.season}${after} ?`, s.wins, drivers.filter((o) => o !== s).map((o) => o.wins).concat([0, 1, 2, 3, 4, 5]), rng));
  }

  // Pilotes
  for (const s of shuffle(drivers.slice(0, 16), rng).slice(0, 3)) {
    qs.push(mcq('pilotes', `f1-team-${s.driver.id}`, `Pour quelle écurie court ${s.driver.name} en ${d.season} ?`, s.teams.at(-1)?.name, teamNames, rng));
    const nat = NATIONALITIES[s.driver.nationality];
    if (nat) qs.push(mcq('pilotes', `f1-nat-${s.driver.id}`, `Quelle est la nationalité de ${s.driver.name} ?`, nat, Object.values(NATIONALITIES), rng));
    if (s.driver.number) {
      qs.push(mcq('pilotes', `f1-num-${s.driver.id}`, `Quel numéro porte ${s.driver.name} en ${d.season} ?`, s.driver.number, drivers.map((o) => o.driver.number), rng));
      qs.push(mcq('pilotes', `f1-who-num-${s.driver.id}`, `Quel pilote porte le numéro ${s.driver.number} en ${d.season} ?`, s.driver.name, driverNames, rng));
    }
  }

  // Circuits
  const races = d.schedule;
  for (const r of shuffle(races, rng).slice(0, 3)) {
    qs.push(mcq('circuits', `f1-country-${r.round}`, `Dans quel pays se dispute le ${r.name} ?`, fr(r.country), races.map((x) => fr(x.country)), rng));
    qs.push(mcq('circuits', `f1-circuit-${r.round}`, `Sur quel circuit se dispute le ${r.name} ${d.season} ?`, r.circuit, races.map((x) => x.circuit), rng));
    qs.push(mcq('circuits', `f1-gp-${r.round}`, `Quel Grand Prix se dispute sur le circuit « ${r.circuit} » ?`, r.name, races.map((x) => x.name), rng));
    if (r.locality) qs.push(mcq('circuits', `f1-city-${r.round}`, `Dans quelle ville (ou région) se trouve le circuit « ${r.circuit} » ?`, r.locality, races.map((x) => x.locality), rng));
  }
  return qs;
}

// ---------- WEC ----------

function wecQuestions(d: WecSeason, rng: () => number): Q[] {
  const qs: Q[] = [];
  const className = (id: string) => d.classes.find((c) => c.id === id)?.name ?? id;
  // Mauvaises réponses prises dans la même catégorie (pas une GT3 pour une question Hypercar).
  const podiumsOf = (classId: string) => d.events.flatMap((e) => e.results?.filter((r) => r.classId === classId).flatMap((r) => r.podium) ?? []);
  const allDrivers = d.events.flatMap((e) => e.results?.flatMap((r) => r.podium.flatMap((p) => p.drivers)) ?? []);

  // Palmarès et pilotes
  for (const e of shuffle(d.events.filter((x) => x.results?.length), rng).slice(0, 3)) {
    const res = e.results![Math.floor(rng() * e.results!.length)];
    const winner = res.podium.find((p) => p.position === 1);
    const where = `en ${className(res.classId)} aux ${e.name} ${d.season}`;
    const same = podiumsOf(res.classId);
    const sameClassCars = d.manufacturers.filter((m) => m.class === res.classId).map((m) => m.car);
    qs.push(mcq('palmares', `wec-win-${e.shortName}-${res.classId}`, `Quelle équipe a gagné ${where} ?`, winner?.team, same.map((p) => p.team), rng));
    qs.push(mcq('palmares', `wec-car-win-${e.shortName}-${res.classId}`, `Quelle voiture a gagné ${where} ?`, winner?.car, [...same.map((p) => p.car), ...sameClassCars], rng));
    if (winner?.drivers.length) {
      const pick = winner.drivers[Math.floor(rng() * winner.drivers.length)];
      const others = allDrivers.filter((n) => !winner.drivers.includes(n));
      qs.push(mcq('pilotes', `wec-crew-${e.shortName}-${res.classId}`, `Lequel de ces pilotes faisait partie de l’équipage vainqueur ${where} ?`, pick, others, rng));
    }
  }
  const st = d.standings as (WecSeason['standings'] & { hypercarManufacturers?: Array<{ manufacturer: string }> }) | null;
  if (st?.hypercarManufacturers?.[0]) {
    qs.push(mcq('palmares', 'wec-maker-leader', `Quel constructeur mène le championnat Hypercar ${d.season} (après la manche ${st.afterRound}) ?`, st.hypercarManufacturers[0].manufacturer, st.hypercarManufacturers.slice(1).map((m) => m.manufacturer), rng));
  }

  // Voitures engagées
  const hyper = d.manufacturers.filter((m) => m.class === 'hypercar');
  for (const m of shuffle(hyper, rng).slice(0, 2)) {
    qs.push(mcq('voitures', `wec-car-${m.name}`, `Quelle voiture la marque ${m.name} engage-t-elle en Hypercar en ${d.season} ?`, m.car, hyper.map((x) => x.car), rng));
    qs.push(mcq('voitures', `wec-maker-${m.name}`, `Quelle marque engage la ${m.car} en Hypercar en ${d.season} ?`, m.name, hyper.map((x) => x.name), rng));
  }

  // Circuits
  const events = d.events.filter((x) => x.status !== 'cancelled');
  for (const e of shuffle(events, rng).slice(0, 3)) {
    qs.push(mcq('circuits', `wec-country-${e.shortName}`, `Dans quel pays se disputent les ${e.name} ?`, e.country, events.map((x) => x.country), rng));
    qs.push(mcq('circuits', `wec-circuit-${e.shortName}`, `Sur quel circuit se disputent les ${e.name} ${d.season} ?`, e.circuit, events.map((x) => x.circuit), rng));
    if (e.durationLabel) qs.push(mcq('circuits', `wec-duration-${e.shortName}`, `Quelle est la durée de course des ${e.name} ${d.season} ?`, e.durationLabel, events.map((x) => x.durationLabel), rng));
  }
  return qs;
}

// ---------- WRC ----------

const SURFACES = ['asphalte', 'terre', 'neige', 'mixte'];

function wrcQuestions(d: WrcSeason, rng: () => number): Q[] {
  const qs: Q[] = [];
  const st = d.standings;
  const allDrivers = d.events.flatMap((e) => e.results?.podium.map((p) => p.driver) ?? []).concat(st?.drivers.map((s) => s.driver) ?? []);
  const allCars: Array<string | null> = [...d.teams.map((t) => t.car), ...d.events.flatMap((x) => x.results?.podium.map((p) => p.car) ?? [])];

  // Palmarès
  for (const e of shuffle(d.events.filter((x) => x.results), rng).slice(0, 3)) {
    const podium = e.results!.podium;
    qs.push(mcq('palmares', `wrc-win-${e.shortName}`, `Qui a remporté le ${e.name} ${d.season} ?`, podium.find((p) => p.position === 1)?.driver, allDrivers, rng));
    qs.push(mcq('palmares', `wrc-second-${e.shortName}`, `Qui a terminé deuxième du ${e.name} ${d.season} ?`, podium.find((p) => p.position === 2)?.driver, allDrivers, rng));
    qs.push(mcq('voitures', `wrc-wincar-${e.shortName}`, `Avec quelle voiture le ${e.name} ${d.season} a-t-il été gagné ?`, podium.find((p) => p.position === 1)?.car, allCars, rng));
  }
  if (st?.drivers[0]) qs.push(mcq('palmares', 'wrc-leader', `Qui est en tête du championnat WRC ${d.season} (après la manche ${st.afterRound}) ?`, st.drivers[0].driver, st.drivers.slice(1).map((s) => s.driver), rng));
  if (st?.manufacturers[0]) qs.push(mcq('palmares', 'wrc-maker-leader', `Quelle équipe mène le championnat des constructeurs WRC ${d.season} ?`, st.manufacturers[0].team, st.manufacturers.slice(1).map((m) => m.team), rng));

  // Pilotes
  for (const s of shuffle((st?.drivers ?? []).filter((x) => x.coDriver), rng).slice(0, 2)) {
    qs.push(mcq('pilotes', `wrc-codriver-${s.driver}`, `Qui est le copilote de ${s.driver} en ${d.season} ?`, s.coDriver, (st?.drivers ?? []).map((x) => x.coDriver), rng));
  }
  for (const t of shuffle(d.teams.filter((x) => x.drivers.length), rng).slice(0, 2)) {
    const driver = t.drivers[Math.floor(rng() * t.drivers.length)];
    qs.push(mcq('pilotes', `wrc-team-${driver}`, `Pour quelle équipe roule ${driver} en ${d.season} ?`, t.name, d.teams.map((x) => x.name), rng));
    qs.push(mcq('voitures', `wrc-car-${t.name}`, `Quelle voiture engage l’équipe ${t.name} en ${d.season} ?`, t.car, d.teams.map((x) => x.car), rng));
  }

  // Rallyes (l'équivalent des circuits en WRC)
  const events = d.events.filter((x) => x.status !== 'cancelled');
  for (const e of shuffle(events, rng).slice(0, 3)) {
    if (e.surface && SURFACES.includes(e.surface)) qs.push(mcq('circuits', `wrc-surface-${e.shortName}`, `Sur quelle surface se dispute le ${e.name} ?`, e.surface, SURFACES, rng));
    qs.push(mcq('circuits', `wrc-country-${e.shortName}`, `Dans quel pays se dispute le ${e.name} ?`, e.country, events.map((x) => x.country), rng));
    if (e.base) qs.push(mcq('circuits', `wrc-base-${e.shortName}`, `Quelle ville accueille le parc d’assistance du ${e.name} ${d.season} ?`, e.base, events.map((x) => x.base), rng));
    if (e.stages) qs.push(mcq('circuits', `wrc-stages-${e.shortName}`, `Combien de spéciales compte le ${e.name} ${d.season} ?`, e.stages, events.map((x) => x.stages), rng));
  }
  return qs;
}

// ---------- Voitures du catalogue ----------

/** Retire d'un nom de version les puissances et années (« SL 43 (435 ch) » → « SL 43 »). */
const cleanVariant = (v: string) => v.replace(/\(([^)]*\d+\s*(ch|kW|cv)[^)]*|\d{4})\)/gi, '').replace(/\b\d+\s*(ch|kW|cv)\b/gi, '').replace(/\s{2,}/g, ' ').trim();

/** Modèle sans répéter la marque (« Mercedes-AMG SL » plutôt que « Mercedes-Benz Mercedes-AMG SL »). */
function modelLabel(c: CarSummary): string {
  const firstWord = (s: string) => s.split(/[\s-]/)[0].toLowerCase();
  return firstWord(c.modelName) === firstWord(c.brandName) ? c.modelName : `${c.brandName} ${c.modelName}`;
}

/** Nom complet d'une carte : modèle + version, sans doublon (« BMW M4 Competition » plutôt que « BMW M4 M4 Competition »). */
function label(c: CarSummary): string {
  const model = modelLabel(c);
  const v = c.card?.variantName ? cleanVariant(c.card.variantName) : '';
  if (!v) return model;
  return v.toLowerCase().startsWith(c.modelName.toLowerCase()) ? `${model.slice(0, model.length - c.modelName.length).trim()} ${v}`.trim() : `${model} ${v}`;
}

/** Génération entre parenthèses, seulement si elle apporte une information (code ou numéro, pas de redite). */
function generationHint(c: CarSummary): string {
  const g = c.generationName;
  const lower = g.toLowerCase();
  if (!g || lower.includes(c.brandName.toLowerCase()) || lower.includes(c.modelName.toLowerCase()) || /\d{4}/.test(g)) return '';
  return ` (${g})`;
}

/** Questions sur les cartes du catalogue liées à la discipline (endurance pour le WEC, rallye pour le WRC, sportives pour la F1). */
function catalogQuestions(discipline: QuizDiscipline, cards: CarSummary[], rng: () => number): Q[] {
  const wanted = discipline === 'wec' ? ['endurance'] : discipline === 'wrc' ? ['rally'] : ['supercar', 'sports'];
  const pool = cards.filter((c) => c.categories.some((k) => wanted.includes(k)));
  if (pool.length < 4) return [];
  const qs: Q[] = [];
  const brands = [...new Set(pool.map((c) => c.brandName))];

  for (const c of shuffle(pool, rng).slice(0, 3)) {
    // La question ne doit pas contenir la réponse (vérifié aussi par mcq).
    // Nom de modèle trop court (« F1 », « M1 ») : ambigu sans la marque, on ne pose pas la question.
    if (c.modelName.length > 2) qs.push(mcq('voitures', `car-brand-${c.card?.id ?? c.id}`, `Quelle marque a construit la ${c.modelName}${generationHint(c)} ?`, c.brandName, brands, rng));
    const hp = c.card?.powerHp;
    if (hp) {
      const near = pool.map((o) => o.card?.powerHp).filter((p): p is number => !!p && p !== hp && Math.abs(p - hp) / hp < 0.5);
      qs.push(mcq('voitures', `car-hp-${c.card?.id ?? c.id}`, `Quelle puissance annonce la ${label(c)} ?`, `${hp} ch`, near.map((p) => `${p} ch`), rng));
    }
    // Sans génération clairement nommée, la question serait ambiguë (quelle Vanquish ?) : on ne la pose pas.
    if (c.startYear && generationHint(c)) {
      const years = pool.map((o) => o.startYear).filter((y): y is number => !!y && Math.abs(y - c.startYear!) <= 12);
      qs.push(mcq('voitures', `car-year-${c.id}`, `En quelle année est apparue la ${modelLabel(c)}${generationHint(c)} ?`, c.startYear, years, rng));
    }
  }

  // « La plus puissante » : 4 cartes de puissances toutes différentes.
  const four: CarSummary[] = [];
  for (const c of shuffle(pool.filter((x) => x.card?.powerHp), rng)) {
    if (!four.some((f) => f.card!.powerHp === c.card!.powerHp || label(f) === label(c))) four.push(c);
    if (four.length === 4) break;
  }
  if (four.length === 4) {
    const best = four.reduce((a, b) => (b.card!.powerHp! > a.card!.powerHp! ? b : a));
    qs.push({ id: `car-max-${four.map((f) => f.card?.id).join('-')}`, theme: 'voitures', prompt: 'Laquelle de ces voitures est la plus puissante ?', answer: label(best), options: shuffle(four.map(label), rng) });
  }
  return qs;
}

/**
 * Tire un questionnaire de 5 questions distinctes (null si les données sont insuffisantes),
 * en alternant les thèmes pour ne jamais poser 5 fois le même type de question.
 */
export function buildQuiz(
  discipline: QuizDiscipline,
  data: { f1?: F1Overview | null; wec?: WecSeason | null; wrc?: WrcSeason | null; cards?: CarSummary[] | null },
  rng: () => number = Math.random,
): QuizQuestion[] | null {
  const raw = [
    ...(discipline === 'f1' ? (data.f1 ? f1Questions(data.f1, rng) : [])
      : discipline === 'wec' ? (data.wec ? wecQuestions(data.wec, rng) : [])
        : (data.wrc ? wrcQuestions(data.wrc, rng) : [])),
    ...catalogQuestions(discipline, data.cards ?? [], rng),
  ];
  const unique = [...new Map(raw.filter((q): q is QuizQuestion => !!q).map((q) => [q.prompt, q])).values()];
  if (unique.length < QUIZ_LENGTH) return null;

  // Un thème après l'autre (dans un ordre tiré au hasard), puis on complète.
  const byTheme = new Map<QuizTheme, QuizQuestion[]>();
  for (const q of shuffle(unique, rng)) byTheme.set(q.theme, [...(byTheme.get(q.theme) ?? []), q]);
  const themes = shuffle([...byTheme.keys()], rng);
  const picked: QuizQuestion[] = [];
  while (picked.length < QUIZ_LENGTH) {
    for (const t of themes) {
      const q = byTheme.get(t)!.shift();
      if (q && picked.length < QUIZ_LENGTH) picked.push(q);
    }
  }
  return shuffle(picked, rng);
}
