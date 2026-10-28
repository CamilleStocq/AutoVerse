/** Contrats des réponses de l'API (consommés par le frontend). */
import type {
  Brand, CategoryId, ConfirmationStatus, Currency, Generation, GenerationStatus, MarketCode,
  PartialDate, Powertrain, PriceRange, PriceType, Source,
} from './types.ts';

export interface ResolvedImage {
  src: string;
  thumb: string;
  width: number;
  height: number;
  depicts: string;
  isOfficial: boolean;
  isIllustration: boolean;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  pageUrl: string | null;
}

export interface PriceView {
  amount: number;
  currency: Currency;
  market: MarketCode;
  type: PriceType;
  asOf: string;
  variantName: string;
  source: Source;
  estimate?: { low: number; high: number; confidence: 'low' | 'medium' | 'high' } | null;
}

export interface CarSummary {
  id: string;
  brandId: string;
  brandName: string;
  brandAccent: string;
  modelId: string;
  modelName: string;
  generationName: string;
  yearsLabel: string;
  startYear: number | null;
  status: GenerationStatus;
  confirmation: ConfirmationStatus | null;
  categories: CategoryId[];
  powertrains: Powertrain[];
  segment: string;
  bodyStyles: string[];
  priceRange: PriceRange | null;
  image: ResolvedImage | null;
  keyFact: { label: string; value: string } | null;
  maxPowerHp: number | null;
  /** Prix non estimé le plus bas sur le marché demandé (null si non communiqué). */
  startingPrice: PriceView | null;
  /** Prix vérifié sur un autre marché, affiché uniquement avec le nom de ce marché. */
  otherMarketPrice: PriceView | null;
  /** Estimation publiée par une source (jamais présentée comme officielle). */
  estimatedPrice: PriceView | null;
  /** Date de sortie la plus pertinente (disponibilité > livraisons > commandes > présentation). */
  releaseDate: PartialDate | null;
  releaseDateKind: 'marketAvailability' | 'firstDeliveries' | 'ordersOpen' | 'presentation' | null;
  isUpcoming: boolean;
  variantCount: number;
  updatedAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SimilarCar {
  car: CarSummary;
  reasons: string[];
  score: number;
}

export interface CarDetail {
  generation: Generation;
  summary: CarSummary;
  brand: Brand;
  images: ResolvedImage[];
  previous: Generation | null;
  next: CarSummary | null;
  otherGenerations: CarSummary[];
  similar: SimilarCar[];
}

export interface FacetCount { id: string; label: string; count: number }

export interface CatalogMeta {
  brands: Array<Brand & { carCount: number }>;
  categories: FacetCount[];
  powertrains: FacetCount[];
  years: { min: number; max: number } | null;
  totalCars: number;
  dataUpdatedAt: string | null;
}

/** Enveloppe de toutes les données issues de sources externes. */
export interface SourcedPayload<T> {
  data: T;
  fetchedAt: string;
  stale: boolean;
  /** Sources consultées (noms + URL publique). */
  sources: Array<{ label: string; url: string }>;
  errors: string[];
}

// ---------- Actualité ----------
export type NewsCategory =
  | 'new-models' | 'reveals' | 'range' | 'engines' | 'tech-innovation' | 'ev-batteries'
  | 'facelift-generation' | 'pricing' | 'recalls' | 'strategy' | 'technology' | 'regulation' | 'other';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  image: string | null;
  publishedAt: string; // date de publication de l'article
  /** Date de l'événement annoncé — seulement si la source l'indique explicitement. */
  eventDate: string | null;
  source: { id: string; name: string; type: 'manufacturer' | 'press'; homepage: string };
  brands: string[];
  /** Fiches du catalogue mentionnées (modèle reconnu dans le titre ou le résumé). */
  models: Array<{ id: string; name: string }>;
  categories: NewsCategory[];
  /** Autres médias ayant repris la même annonce (doublons regroupés). */
  alsoReportedBy: Array<{ name: string; url: string }>;
  lang: string;
  relevance?: number;
}

// ---------- Sport ----------
export type Discipline = 'f1' | 'wec' | 'wrc';

export interface SportEvent {
  id: string;
  discipline: Discipline;
  season: number;
  round: number | null;
  name: string;
  venue: string; // circuit ou base du rallye
  country: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  /** Horaire de départ officiel (UTC) — absent si non publié. */
  mainStartUtc: string | null;
  sessions: Array<{ name: string; startUtc: string }>;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  sourceLabel: string;
  sourceUrl: string;
}
