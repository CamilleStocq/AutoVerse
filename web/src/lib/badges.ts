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
  /** Boosters offerts à l'obtention : 1 (facile), 2 (moyen) ou 3 (difficile). */
  reward: 1 | 2 | 3;
  unlocked: boolean;
}

type Owned = Record<string, unknown>;

const key = (c: CarSummary) => c.card?.id ?? c.id;

const CARDS: [string, string] = ['carte', 'cartes'];

type Reward = Badge['reward'];

function series(id: string, label: string, description: string, icon: BadgeIcon, reward: Reward, cards: CarSummary[], owned: Owned): Badge | null {
  if (!cards.length) return null;
  const have = cards.filter((c) => owned[key(c)]).length;
  return { id, label, description, icon, have, goal: cards.length, unit: CARDS, reward, unlocked: have >= cards.length };
}

function count(id: string, label: string, description: string, icon: BadgeIcon, reward: Reward, have: number, goal: number, unit: [string, string] = CARDS): Badge {
  return { id, label, description, icon, have: Math.min(have, goal), goal, unit, reward, unlocked: have >= goal };
}

const inCategory = (all: CarSummary[], c: CategoryId) => all.filter((x) => x.categories.includes(c));
const ofRarity = (all: CarSummary[], r: Rarity) => all.filter((x) => (x.card?.rarity ?? 'common') === r);

export function computeBadges(all: CarSummary[], owned: Owned, opened: number): Badge[] {
  const total = all.filter((c) => owned[key(c)]).length;
  const legendary = ofRarity(all, 'legendary');
  const ownedLegendary = legendary.filter((c) => owned[key(c)]).length;

  // Marques complètes : seules les marques d'au moins 10 cartes comptent (une petite série
  // de 2-3 cartes se complète par chance dès les premiers boosters).
  const byBrand = new Map<string, CarSummary[]>();
  for (const c of all) byBrand.set(c.brandId, [...(byBrand.get(c.brandId) ?? []), c]);
  const brandsDone = [...byBrand.values()].filter((cards) => cards.length >= 10 && cards.every((c) => owned[key(c)])).length;

  // Paliers choisis pour qu'aucun badge ne soit atteint avec les 3 boosters de bienvenue (21 cartes) :
  // pas d'effet boule de neige (vérifié par simulation dans test/badges.test.ts).
  const list: Array<Badge | null> = [
    count('cards-50', 'Collectionneur', 'Collectionner 50 cartes', 'cards', 1, total, 50),
    count('cards-100', 'Centurion', 'Collectionner 100 cartes', 'cards', 1, total, 100),
    count('cards-250', 'Grand collectionneur', 'Collectionner 250 cartes', 'cards', 2, total, 250),
    count('cards-500', 'Musée privé', 'Collectionner 500 cartes', 'cards', 3, total, 500),
    count('cards-all', 'Collection complète', `Obtenir les ${all.length} cartes`, 'trophy', 3, total, Math.max(all.length, 1)),
    count('legendary-10', 'Dix Légendaires', 'Obtenir 10 cartes Légendaires', 'crown', 1, ownedLegendary, 10),
    count('legendary-25', 'Vingt-cinq Légendaires', 'Obtenir 25 cartes Légendaires', 'crown', 2, ownedLegendary, 25),
    series('legendary-all', 'Panthéon', 'Toutes les cartes Légendaires', 'crown', 3, legendary, owned),
    series('series-endurance', 'Le Mans', 'Toutes les voitures d’endurance', 'clock', 3, inCategory(all, 'endurance'), owned),
    series('series-rally', 'Groupe B', 'Toutes les voitures de rallye', 'mountain', 3, inCategory(all, 'rally'), owned),
    series('series-supercar', 'Supercars', 'Toutes les supercars et hypercars', 'zap', 3, inCategory(all, 'supercar'), owned),
    series('series-classic', 'Légendes de la route', 'Toutes les icônes de collection', 'gem', 3, inCategory(all, 'classic'), owned),
    count('brand-1', 'Marque complète', 'Compléter le dossier d’une marque (10 cartes ou plus)', 'flag', 1, brandsDone, 1, ['marque', 'marques']),
    count('brand-5', 'Cinq marques', 'Compléter 5 dossiers de marque (10 cartes ou plus)', 'flag', 2, brandsDone, 5, ['marque', 'marques']),
    count('boosters-25', 'Déballeur', 'Ouvrir 25 boosters', 'package', 1, opened, 25, ['booster', 'boosters']),
    count('boosters-75', 'Accro aux boosters', 'Ouvrir 75 boosters', 'package', 2, opened, 75, ['booster', 'boosters']),
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
  const { state, owned, markBadges, rewardBadges } = useCollection();
  const all = cards.data ?? [];
  const badges = useMemo(() => computeBadges(all, owned, state.opened), [all, owned, state.opened]);
  const unseen = badges.filter((b) => b.unlocked && !state.badges.includes(b.id));
  return { badges, unseen, rewarded: state.rewarded, loading: cards.isLoading, error: cards.isError, retry: () => cards.refetch(), markBadges, rewardBadges };
}
