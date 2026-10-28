import type { CarSummary } from './api.ts';
import type { CategoryId, Generation, MarketCode, Powertrain, PriceRange } from './types.ts';

export type Usage = Generation['usage'][number];
export type Period = 'current' | 'upcoming' | 'classic';
export type Interest = 'engines' | 'batteries' | 'performance' | 'tech' | 'design';

export interface Preferences {
  /** 'all' = « Toutes les marques » ; [] = étape ignorée (aucune préférence). */
  brands: string[] | 'all';
  categories: CategoryId[];
  powertrains: Powertrain[];
  priceRanges: PriceRange[];
  periods: Period[];
  usages: Usage[];
  interests: Interest[];
  market: MarketCode;
}

export interface Profile {
  id: string;
  onboardedAt: string | null;
  preferences: Preferences;
  updatedAt: string;
}

export interface WishlistEntry {
  generationId: string;
  addedAt: string;
  /** Instantané de la carte à l'ajout (conservé même si la fiche change ou disparaît). */
  snapshot: CarSummary;
}

export const DEFAULT_PREFERENCES: Preferences = {
  brands: [],
  categories: [],
  powertrains: [],
  priceRanges: [],
  periods: [],
  usages: [],
  interests: [],
  market: 'BE',
};
