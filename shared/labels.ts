import type {
  CategoryId, ConfirmationStatus, Drivetrain, GenerationStatus, MarketCode, Powertrain, PriceRange, PriceType,
} from './types.ts';
import type { Interest, Period, Usage } from './profile.ts';
import type { NewsCategory } from './api.ts';

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  sports: 'Sportives',
  supercar: 'Supercars et hypercars',
  'sport-sedan': 'Berlines sportives',
  coupe: 'Coupés',
  convertible: 'Cabriolets',
  city: 'Citadines',
  compact: 'Compactes',
  'family-sedan': 'Berlines familiales',
  wagon: 'Breaks',
  suv: 'SUV',
  'sport-suv': 'SUV sportifs',
  luxury: 'Voitures de luxe',
  gt: 'Grand tourisme',
  ev: 'Électriques',
  phev: 'Hybrides rechargeables',
  hybrid: 'Hybrides',
  ice: 'Thermiques',
  offroad: 'Tout-terrain',
  classic: 'Collection et icônes',
};

/** Libellé court au singulier, pour les cartes. */
export const CATEGORY_SHORT: Record<CategoryId, string> = {
  sports: 'Sportive', supercar: 'Supercar', 'sport-sedan': 'Berline sportive', coupe: 'Coupé',
  convertible: 'Cabriolet', city: 'Citadine', compact: 'Compacte', 'family-sedan': 'Berline', wagon: 'Break',
  suv: 'SUV', 'sport-suv': 'SUV sportif', luxury: 'Luxe', gt: 'GT', ev: 'Électrique', phev: 'Hybride rechargeable',
  hybrid: 'Hybride', ice: 'Thermique', offroad: 'Tout-terrain', classic: 'Icône',
};

export const POWERTRAIN_LABELS: Record<Powertrain, string> = {
  petrol: 'Essence', diesel: 'Diesel', hybrid: 'Hybride', phev: 'Hybride rechargeable', ev: 'Électrique',
};

export const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  fwd: 'Traction', rwd: 'Propulsion', awd: 'Transmission intégrale',
};

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  budget: 'Accessible', mid: 'Intermédiaire', premium: 'Premium', luxury: 'Luxe',
};

export const STATUS_LABELS: Record<GenerationStatus, string> = {
  'on-sale': 'Commercialisé', announced: 'Annoncé', 'in-preparation': 'En préparation', discontinued: 'Plus commercialisé',
};

export const CONFIRMATION_LABELS: Record<ConfirmationStatus, string> = {
  rumor: 'Rumeur non confirmée',
  'press-reported': 'Rapporté par la presse',
  'official-announcement': 'Annonce officielle',
  'official-reveal': 'Présentation officielle',
  'orders-open': 'Commandes ouvertes',
  'launch-planned': 'Commercialisation prévue',
  'on-sale': 'Disponible à la vente',
  delayed: 'Date reportée',
  cancelled: 'Projet annulé',
};

/** Niveau de confirmation (0 = rumeur … 6 = en vente) pour les indicateurs visuels. */
export const CONFIRMATION_LEVEL: Record<ConfirmationStatus, number> = {
  rumor: 0, 'press-reported': 1, 'official-announcement': 2, 'official-reveal': 3,
  'orders-open': 4, 'launch-planned': 4, 'on-sale': 5, delayed: 2, cancelled: -1,
};

export const isUnconfirmed = (c: ConfirmationStatus | null | undefined) => c === 'rumor' || c === 'press-reported';

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  official: 'Prix officiel',
  'range-start': 'Prix de départ',
  variant: 'Prix de la version',
  estimate: 'Estimation',
};

export const MILESTONE_LABELS = {
  presentation: 'Présentation',
  ordersOpen: 'Ouverture des commandes',
  productionStart: 'Début de production',
  firstDeliveries: 'Premières livraisons',
  marketAvailability: 'Disponibilité commerciale',
} as const;

export const MARKETS: Array<{ code: MarketCode; name: string; currency: 'EUR' | 'CHF' | 'GBP'; locale: string }> = [
  { code: 'BE', name: 'Belgique', currency: 'EUR', locale: 'fr-BE' },
  { code: 'FR', name: 'France', currency: 'EUR', locale: 'fr-FR' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', locale: 'fr-LU' },
  { code: 'NL', name: 'Pays-Bas', currency: 'EUR', locale: 'nl-NL' },
  { code: 'DE', name: 'Allemagne', currency: 'EUR', locale: 'de-DE' },
  { code: 'CH', name: 'Suisse', currency: 'CHF', locale: 'fr-CH' },
  { code: 'IT', name: 'Italie', currency: 'EUR', locale: 'it-IT' },
  { code: 'ES', name: 'Espagne', currency: 'EUR', locale: 'es-ES' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', locale: 'en-GB' },
];

export const USAGE_LABELS: Record<Usage, string> = {
  'driving-pleasure': 'Plaisir de conduite', daily: 'Quotidien', family: 'Famille',
  travel: 'Voyage', track: 'Circuit', collection: 'Collection',
};

export const PERIOD_LABELS: Record<Period, string> = {
  current: 'Modèles actuels', upcoming: 'Nouveautés à venir', classic: 'Anciens modèles et icônes',
};

export const INTEREST_LABELS: Record<Interest, string> = {
  engines: 'Moteurs', batteries: 'Batteries', performance: 'Performances', tech: 'Technologies embarquées', design: 'Design',
};

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  'new-models': 'Nouveaux modèles',
  reveals: 'Présentations officielles',
  range: 'Évolutions de gamme',
  engines: 'Nouveaux moteurs',
  'tech-innovation': 'Innovations techniques',
  'ev-batteries': 'Électrique et batteries',
  'facelift-generation': 'Restylages et générations',
  pricing: 'Prix et commercialisation',
  recalls: 'Rappels',
  strategy: 'Stratégies des constructeurs',
  technology: 'Technologies',
  regulation: 'Réglementation',
  other: 'Divers',
};
