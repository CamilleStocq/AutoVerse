/**
 * Détection des changements entre la version publiée et la nouvelle version des données :
 * nouvelles dates de sortie, nouveaux modèles annoncés, résultats F1, podiums WEC et WRC.
 * Fonctions pures : l'identifiant de chaque événement est déterministe, ce qui garantit
 * qu'un même changement n'est jamais notifié deux fois.
 */
import type { AppEvent } from '../../shared/api.ts';
import type { Brand, Generation, LaunchMilestones } from '../../shared/types.ts';
import type { F1Overview, WecSeason, WrcSeason } from '../../shared/sport.ts';
import { formatPartialDate } from '../../shared/dates.ts';
import { CONFIRMATION_LABELS, MILESTONE_LABELS } from '../../shared/labels.ts';

const MILESTONE_KEYS = Object.keys(MILESTONE_LABELS) as Array<keyof LaunchMilestones>;

/** Prochaine étape datée la plus parlante pour présenter un nouveau modèle. */
function bestDate(g: Generation): string | null {
  for (const k of ['marketAvailability', 'firstDeliveries', 'ordersOpen', 'presentation'] as const) {
    const d = g.launch?.[k]?.date;
    if (d) return `${MILESTONE_LABELS[k]} : ${formatPartialDate(d)}`;
  }
  return null;
}

export function releaseEvents(prev: Generation[] | null, next: Generation[], brands: Brand[], now: string): AppEvent[] {
  if (!prev) return []; // première publication : pas de rafale de notifications
  const before = new Map(prev.map((g) => [g.id, g]));
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
  const events: AppEvent[] = [];
  for (const g of next) {
    if (!g.upcoming) continue;
    const name = `${brandName(g.brandId)} ${g.modelName}`;
    const base = { topic: 'releases' as const, url: `voiture/${g.id}`, createdAt: now, brandId: g.brandId };
    const old = before.get(g.id);
    if (!old) {
      events.push({
        ...base,
        id: `release-new-${g.id}`,
        title: `${name} : nouveau modèle à venir`,
        body: [CONFIRMATION_LABELS[g.upcoming.confirmation], bestDate(g)].filter(Boolean).join(' · '),
      });
      continue;
    }
    for (const k of MILESTONE_KEYS) {
      const date = g.launch?.[k]?.date;
      if (!date) continue;
      const label = formatPartialDate(date);
      const oldDate = old.launch?.[k]?.date;
      const oldLabel = oldDate ? formatPartialDate(oldDate) : null;
      if (oldLabel === label) continue;
      events.push({
        ...base,
        id: `release-${g.id}-${k}-${label}`,
        title: `${name} : ${MILESTONE_LABELS[k].toLowerCase()} ${label}`,
        body: oldLabel ? `Date modifiée (auparavant : ${oldLabel}).` : 'Nouvelle date annoncée.',
      });
    }
    const conf = g.upcoming.confirmation;
    if (old.upcoming?.confirmation !== conf && (conf === 'delayed' || conf === 'cancelled' || conf === 'orders-open' || conf === 'on-sale')) {
      events.push({ ...base, id: `release-${g.id}-status-${conf}`, title: `${name} : ${CONFIRMATION_LABELS[conf].toLowerCase()}`, body: bestDate(g) ?? 'Statut mis à jour.' });
    }
  }
  return events;
}

export function f1Events(prev: F1Overview | null, next: F1Overview | null, now: string): AppEvent[] {
  const last = next?.lastRace;
  if (!prev || !last) return [];
  const prevLast = prev.lastRace;
  if (prevLast && prevLast.race.season === last.race.season && prevLast.race.round === last.race.round) return [];
  const podium = last.results.slice(0, 3).map((r) => `${r.position}. ${r.driver.name} (${r.team.name})`).join(' · ');
  return [{
    id: `f1-${last.race.season}-${last.race.round}-race`,
    topic: 'f1',
    title: `F1 · ${last.race.name} : résultats`,
    body: podium,
    url: 'sport/f1',
    createdAt: now,
  }];
}

type SeriesEvent = { round: number | null; shortName: string; name: string; results: unknown };

function newlyCompleted<T extends SeriesEvent>(prev: T[] | undefined, next: T[]): T[] {
  if (!prev) return [];
  const had = new Set(prev.filter((e) => e.results).map((e) => `${e.round}-${e.shortName}`));
  return next.filter((e) => e.results && !had.has(`${e.round}-${e.shortName}`));
}

export function wecEvents(prev: WecSeason | null, next: WecSeason | null, now: string): AppEvent[] {
  if (!next) return [];
  return newlyCompleted(prev?.events, next.events).map((e) => ({
    id: `wec-${next.season}-${e.round ?? e.shortName}`,
    topic: 'wec' as const,
    title: `WEC · ${e.name} : podiums`,
    body: (e.results ?? []).map((r) => {
      const cls = next.classes.find((c) => c.id === r.classId)?.name ?? r.classId;
      const w = r.podium[0];
      return w ? `${cls} : ${w.carNumber ? `#${w.carNumber} ` : ''}${w.team}` : null;
    }).filter(Boolean).join(' · '),
    url: 'sport/wec',
    createdAt: now,
  }));
}

export function wrcEvents(prev: WrcSeason | null, next: WrcSeason | null, now: string): AppEvent[] {
  if (!next) return [];
  return newlyCompleted(prev?.events, next.events).map((e) => ({
    id: `wrc-${next.season}-${e.round ?? e.shortName}`,
    topic: 'wrc' as const,
    title: `WRC · ${e.name} : résultats`,
    body: (e.results?.podium ?? []).map((p) => `${p.position}. ${p.driver}`).join(' · '),
    url: 'sport/wrc',
    createdAt: now,
  }));
}

/** Fusionne les nouveaux événements avec l'historique publié (sans doublon, plus récents d'abord). */
export function mergeEvents(history: AppEvent[], fresh: AppEvent[], max = 80): { all: AppEvent[]; added: AppEvent[] } {
  const known = new Set(history.map((e) => e.id));
  const added = fresh.filter((e, i) => !known.has(e.id) && fresh.findIndex((x) => x.id === e.id) === i);
  const all = [...added, ...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
  return { all, added };
}
