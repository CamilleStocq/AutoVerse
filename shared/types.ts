/**
 * Modèle de données partagé entre l'API et le frontend.
 *
 * Principes (cf. README « Règles métier ») :
 * - Un modèle (Model) ≠ ses générations (Generation) ≠ ses variantes (Variant).
 * - Les caractéristiques techniques vivent uniquement sur une Variant.
 * - Toute donnée absente vaut `null` : on n'invente jamais une valeur.
 * - Les dates peuvent être partielles (année seule, trimestre, mois) : PartialDate.
 * - Chaque information importante est rattachée à une Source.
 */

export type MarketCode = 'BE' | 'FR' | 'LU' | 'NL' | 'DE' | 'CH' | 'IT' | 'ES' | 'GB';
export type Currency = 'EUR' | 'CHF' | 'GBP';

export type CategoryId =
  | 'sports' // Sportives
  | 'supercar' // Supercars et hypercars
  | 'sport-sedan' // Berlines sportives
  | 'coupe'
  | 'convertible'
  | 'city' // Citadines
  | 'compact'
  | 'family-sedan'
  | 'wagon' // Breaks
  | 'suv'
  | 'sport-suv'
  | 'luxury'
  | 'gt' // Grand tourisme
  | 'ev' // Électriques
  | 'phev' // Hybrides rechargeables
  | 'hybrid'
  | 'ice' // Thermiques
  | 'offroad'
  | 'classic'; // Collection et modèles iconiques

export type Powertrain = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'ev';
export type Drivetrain = 'fwd' | 'rwd' | 'awd';
export type PriceRange = 'budget' | 'mid' | 'premium' | 'luxury';

/** Date à précision variable. Ne jamais compléter un mois ou un jour non publié. */
export interface PartialDate {
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number; // 1-12
  day?: number;
  /** « early » / « mid » / « late » lorsque la source dit « début 2027 », etc. */
  half?: 'early' | 'mid' | 'late';
}

export type SourceType = 'manufacturer' | 'press' | 'championship' | 'database' | 'community';

export interface Source {
  label: string; // ex. « Porsche Newsroom »
  url: string; // URL réellement consultée
  type: SourceType;
  publishedAt?: string | null; // ISO date de publication de la source
  retrievedAt: string; // ISO date de consultation
}

export type PriceType =
  | 'official' // Prix officiel annoncé par le constructeur
  | 'range-start' // Prix de départ de la gamme (« à partir de »)
  | 'variant' // Prix d'une variante précise
  | 'estimate'; // Estimation pour un modèle futur (jamais officiel)

export interface Price {
  market: MarketCode;
  amount: number; // TTC, dans la devise indiquée
  currency: Currency;
  type: PriceType;
  asOf: string; // ISO date à laquelle ce prix était valable / constaté
  source: Source;
  /** Pour type = 'estimate' : fourchette et niveau d'incertitude. */
  estimate?: { low: number; high: number; confidence: 'low' | 'medium' | 'high' } | null;
}

export interface Dimensions {
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
}

/** Une version précise (motorisation + finition). Les specs n'existent qu'ici. */
export interface Variant {
  id: string; // ex. "porsche-911-992-2-carrera"
  name: string; // ex. "Carrera"
  tier: 'entry' | 'mid' | 'sport' | 'top';
  powertrain: Powertrain;
  engine: {
    architecture: string | null; // ex. "6 cylindres à plat biturbo"
    displacementCc: number | null;
    electricMotors?: number | null;
  };
  powerHp: number | null; // ch (DIN)
  powerKw: number | null;
  torqueNm: number | null;
  drivetrain: Drivetrain | null;
  gearbox: string | null;
  accel0100s: number | null;
  topSpeedKmh: number | null;
  /** Consommation mixte officielle (WLTP), l/100 km ou kWh/100 km. */
  consumption: { value: number; unit: 'l/100km' | 'kWh/100km'; cycle: 'WLTP' | 'NEDC' | 'EPA' } | null;
  electricRangeKm: number | null; // WLTP
  batteryKwh: number | null; // capacité nette si connue
  charging: { dcMaxKw: number | null; dc10to80Min: number | null } | null;
  co2Gkm: number | null; // WLTP mixte
  weightKg: number | null; // poids à vide (préciser la norme dans notes si connue)
  dimensions: Dimensions | null;
  seats: number | null;
  trunkL: number | null;
  equipmentHighlights: string[]; // différences d'équipement notables
  prices: Price[];
  notes?: string | null;
  sources: Source[];
}

export type GenerationStatus = 'on-sale' | 'announced' | 'in-preparation' | 'discontinued';

/** Niveau de confirmation d'une nouveauté (rubrique Nouveautés). */
export type ConfirmationStatus =
  | 'rumor' // Rumeur non confirmée
  | 'press-reported' // Information rapportée par la presse
  | 'official-announcement' // Annonce officielle (le constructeur confirme l'existence)
  | 'official-reveal' // Présentation officielle (le véhicule a été montré)
  | 'orders-open' // Ouverture des commandes
  | 'launch-planned' // Commercialisation prévue (date communiquée)
  | 'on-sale' // Disponible à la vente
  | 'delayed' // Date reportée
  | 'cancelled'; // Projet annulé (confirmé)

export interface Milestone {
  date: PartialDate | null; // null = inconnue
  market?: MarketCode | 'EU' | 'WORLD' | null;
  source?: Source | null;
}

/** Étapes de lancement — elles ne sont pas interchangeables. */
export interface LaunchMilestones {
  presentation?: Milestone; // Date de présentation
  ordersOpen?: Milestone; // Début des commandes
  productionStart?: Milestone; // Début de production
  firstDeliveries?: Milestone; // Premières livraisons
  marketAvailability?: Milestone; // Disponibilité commerciale
}

export interface ImageRef {
  /** Nom de fichier Wikimedia Commons, ex. "File:Porsche 992 GT3 IMG 4180.jpg" */
  commonsFile?: string | null;
  /** URL directe si image officielle à usage presse autorisé. */
  url?: string | null;
  caption?: string | null;
  /** Ce que montre réellement la photo (génération / version), pour éviter toute confusion. */
  depicts: string;
  isOfficial: boolean;
  /** Illustration / rendu non officiel : doit être signalé comme tel. */
  isIllustration?: boolean;
  // Champs remplis par le serveur après résolution Commons :
  resolved?: {
    src: string;
    thumb: string;
    width: number;
    height: number;
    author: string | null;
    license: string | null;
    licenseUrl: string | null;
    pageUrl: string;
  } | null;
}

export interface Editorial {
  summary: string; // présentation (éditorial, factuelle)
  positioning: string | null; // positionnement dans la gamme du constructeur
  /** Faits techniques vérifiables. */
  technicalFacts: string[];
  /** Appréciations éditoriales (opinion clairement séparée des faits). */
  pros: string[];
  differentiators: string[];
  pricePositioning: string | null;
  innovations: string[];
  compromises: string[];
}

/** Comparaison avec la génération précédente — uniquement sur versions comparables. */
export interface GenerationChange {
  previousGenerationId: string;
  /** Paire de variantes comparables (ex. Carrera vs Carrera). */
  comparablePair: { currentVariantId: string; previousVariantId: string } | null;
  design: string[];
  technology: string[];
  equipment: string[];
  chassis: string[];
  unchanged: string[];
  tradeoffs: string[];
  sources: Source[];
}

export interface Generation {
  id: string; // ex. "porsche-911-992-2"
  modelId: string; // ex. "porsche-911"
  brandId: string; // ex. "porsche"
  modelName: string; // ex. "911"
  name: string; // ex. "992.2" ou "2e génération"
  yearsLabel: string; // ex. "2024 –" (affichage)
  startYear: number | null;
  endYear: number | null;
  status: GenerationStatus;
  segment: string; // ex. "Sportive GT (segment S)"
  bodyStyles: string[]; // ex. ["Coupé", "Cabriolet", "Targa"]
  /** Classification explicite (jamais déduite du nom). Les catégories de motorisation
   *  ev/phev/hybrid/ice sont recalculées par le serveur depuis les variantes. */
  categories: CategoryId[];
  priceRange: PriceRange | null;
  usage: Array<'driving-pleasure' | 'daily' | 'family' | 'travel' | 'track' | 'collection'>;
  previousGenerationId: string | null;
  nextGenerationId?: string | null;
  images: ImageRef[];
  editorial: Editorial;
  variants: Variant[];
  launch: LaunchMilestones | null;
  /** Rubrique Nouveautés : renseigné pour les modèles annoncés / à venir. */
  upcoming?: {
    confirmation: ConfirmationStatus;
    confirmed: string[]; // ce qui est officiellement annoncé
    unknown: string[]; // caractéristiques encore inconnues
    expectedPowertrains: Powertrain[] | null; // seulement si confirmé
    priceStatus: 'official' | 'estimate' | 'not-announced';
  } | null;
  changes: GenerationChange | null;
  sources: Source[];
  updatedAt: string; // ISO date de dernière mise à jour de la fiche
}

export interface Brand {
  id: string;
  name: string;
  country: string; // pays d'origine (FR)
  founded: number | null;
  /** Couleur d'accent pour l'identité de la carte marque (pas un logo déposé). */
  accent: string;
  group?: string | null;
  wikidataId?: string | null;
}
