/**
 * Badges de collection : calculés à partir des cartes possédées (rien n'est stocké à part
 * la liste des badges déjà annoncés, pour ne féliciter qu'une fois).
 */
import { useMemo } from 'react';
import type { CarSummary, Rarity } from '@shared/api';
import type { CategoryId } from '@shared/types';
import { useCards } from '../hooks/queries';
import { useCollection } from '../state/collection';

export type BadgeIcon = 'cards' | 'crown' | 'gem' | 'flag' | 'mountain' | 'zap' | 'clock' | 'package' | 'trophy';

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: BadgeIcon;
  have: number;
  goal: number;
  /** Ce qui est compté, au singulier puis au pluriel (« carte » / « cartes »). */
  unit: [string, string];
  unlocked: boolean;
}

type Owned = Record<string, unknown>;

const key = (c: CarSummary) => c.card?.id ?? c.id;

const CARDS: [string, string] = ['carte', 'cartes'];

function series(id: string, label: string, description: string, icon: BadgeIcon, cards: CarSummary[], owned: Owned): Badge | null {
  if (!cards.length) return null;
  const have = cards.filter((c) => owned[key(c)]).length;
  return { id, label, description, icon, have, goal: cards.length, unit: CARDS, unlocked: have >= cards.length };
}

function count(id: string, label: string, description: string, icon: BadgeIcon, have: number, goal: number, unit: [string, string] = CARDS): Badge {
  return { id, label, description, icon, have: Math.min(have, goal), goal, unit, unlocked: have >= goal };
}

const inCategory = (all: CarSummary[], c: CategoryId) => all.filter((x) => x.categories.includes(c));
const ofRarity = (all: CarSummary[], r: Rarity) => all.filter((x) => (x.card?.rarity ?? 'common') === r);

export function computeBadges(all: CarSummary[], owned: Owned, opened: number): Badge[] {
  const total = all.filter((c) => owned[key(c)]).length;
  const legendary = ofRarity(all, 'legendary');
  const ownedLegendary = legendary.filter((c) => owned[key(c)]).length;

  // Marques complètes (au moins 3 cartes dans la série pour compter).
  const byBrand = new Map<string, CarSummary[]>();
  for (const c of all) byBrand.set(c.brandId, [...(byBrand.get(c.brandId) ?? []), c]);
  const brandsDone = [...byBrand.values()].filter((cards) => cards.length >= 3 && cards.every((c) => owned[key(c)])).length;

  const list: Array<Badge | null> = [
    count('cards-10', 'Premier garage', 'Collectionner 10 cartes', 'cards', total, 10),
    count('cards-50', 'Collectionneur', 'Collectionner 50 cartes', 'cards', total, 50),
    count('cards-100', 'Centurion', 'Collectionner 100 cartes', 'cards', total, 100),
    count('cards-250', 'Grand collectionneur', 'Collectionner 250 cartes', 'cards', total, 250),
    count('cards-500', 'Musée privé', 'Collectionner 500 cartes', 'cards', total, 500),
    count('cards-all', 'Collection complète', `Obtenir les ${all.length} cartes`, 'trophy', total, Math.max(all.length, 1)),
    count('legendary-1', 'Première Légendaire', 'Obtenir une carte Légendaire', 'crown', ownedLegendary, 1),
    count('legendary-10', 'Dix Légendaires', 'Obtenir 10 cartes Légendaires', 'crown', ownedLegendary, 10),
    series('legendary-all', 'Panthéon', 'Toutes les cartes Légendaires', 'crown', legendary, owned),
    series('series-endurance', 'Le Mans', 'Toutes les voitures d’endurance', 'clock', inCategory(all, 'endurance'), owned),
    series('series-rally', 'Groupe B', 'Toutes les voitures de rallye', 'mountain', inCategory(all, 'rally'), owned),
    series('series-supercar', 'Supercars', 'Toutes les supercars et hypercars', 'zap', inCategory(all, 'supercar'), owned),
    series('series-classic', 'Légendes de la route', 'Toutes les icônes de collection', 'gem', inCategory(all, 'classic'), owned),
    count('brand-1', 'Marque complète', 'Compléter le dossier d’une marque', 'flag', brandsDone, 1, ['marque', 'marques']),
    count('brand-5', 'Cinq marques', 'Compléter 5 dossiers de marque', 'flag', brandsDone, 5, ['marque', 'marques']),
    count('boosters-10', 'Déballeur', 'Ouvrir 10 boosters', 'package', opened, 10, ['booster', 'boosters']),
    count('boosters-50', 'Accro aux boosters', 'Ouvrir 50 boosters', 'package', opened, 50, ['booster', 'boosters']),
  ];
  return list.filter((b): b is Badge => !!b);
}

/** « Encore 3 cartes », « Encore 1 booster »… */
export function remainingText(b: Badge): string {
  const left = b.goal - b.have;
  return `Encore ${left} ${left > 1 ? b.unit[1] : b.unit[0]}`;
}

/** Badges de l'utilisateur, et ceux débloqués mais pas encore vus sur la page Badges. */
export function useBadges() {
  const cards = useCards();
  const { state, owned, markBadges } = useCollection();
  const all = cards.data ?? [];
  const badges = useMemo(() => computeBadges(all, owned, state.opened), [all, owned, state.opened]);
  const unseen = badges.filter((b) => b.unlocked && !state.badges.includes(b.id));
  return { badges, unseen, loading: cards.isLoading, error: cards.isError, retry: () => cards.refetch(), markBadges };
}
