/**
 * Validation des fichiers de données (seed) : une fiche invalide est écartée avec un
 * avertissement au lieu de faire tomber l'API ou d'afficher une donnée douteuse.
 */
import { z } from 'zod';

const num = z.number().finite().nullable();

const partialDate = z.object({
  year: z.number().int().min(1880).max(2100),
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  half: z.enum(['early', 'mid', 'late']).optional(),
});

const source = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  type: z.enum(['manufacturer', 'press', 'championship', 'database', 'community']),
  publishedAt: z.string().nullable().optional(),
  retrievedAt: z.string(),
});

const price = z.object({
  market: z.enum(['BE', 'FR', 'LU', 'NL', 'DE', 'CH', 'IT', 'ES', 'GB']),
  amount: z.number().positive(),
  currency: z.enum(['EUR', 'CHF', 'GBP']),
  type: z.enum(['official', 'range-start', 'variant', 'estimate']),
  asOf: z.string(),
  source,
  estimate: z.object({ low: z.number(), high: z.number(), confidence: z.enum(['low', 'medium', 'high']) }).nullable().optional(),
}).refine((p) => p.type !== 'estimate' || !!p.estimate, { message: 'une estimation doit préciser sa fourchette' });

const variant = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: z.enum(['entry', 'mid', 'sport', 'top']),
  powertrain: z.enum(['petrol', 'diesel', 'hybrid', 'phev', 'ev']),
  engine: z.object({ architecture: z.string().nullable(), displacementCc: num, electricMotors: num.optional() }),
  powerHp: num, powerKw: num, torqueNm: num,
  drivetrain: z.enum(['fwd', 'rwd', 'awd']).nullable(),
  gearbox: z.string().nullable(),
  accel0100s: num, topSpeedKmh: num,
  consumption: z.object({ value: z.number(), unit: z.enum(['l/100km', 'kWh/100km']), cycle: z.enum(['WLTP', 'NEDC', 'EPA']) }).nullable(),
  electricRangeKm: num, batteryKwh: num,
  charging: z.object({ dcMaxKw: num, dc10to80Min: num }).nullable(),
  co2Gkm: num, weightKg: num,
  dimensions: z.object({ lengthMm: num, widthMm: num, heightMm: num, wheelbaseMm: num }).nullable(),
  seats: num, trunkL: num,
  equipmentHighlights: z.array(z.string()).default([]),
  prices: z.array(price).default([]),
  notes: z.string().nullable().optional(),
  sources: z.array(source).default([]),
});

const milestone = z.object({
  date: partialDate.nullable(),
  market: z.string().nullable().optional(),
  source: source.nullable().optional(),
});

const category = z.enum([
  'sports', 'supercar', 'sport-sedan', 'coupe', 'convertible', 'city', 'compact', 'family-sedan', 'wagon',
  'suv', 'sport-suv', 'luxury', 'gt', 'ev', 'phev', 'hybrid', 'ice', 'offroad', 'classic',
]);

export const generationSchema = z.looseObject({
  id: z.string().min(1),
  modelId: z.string().min(1),
  brandId: z.string().min(1),
  modelName: z.string().min(1),
  name: z.string(),
  yearsLabel: z.string(),
  startYear: z.number().int().nullable(),
  endYear: z.number().int().nullable(),
  status: z.enum(['on-sale', 'announced', 'in-preparation', 'discontinued']),
  segment: z.string().default(''),
  bodyStyles: z.array(z.string()).default([]),
  categories: z.array(category).default([]),
  priceRange: z.enum(['budget', 'mid', 'premium', 'luxury']).nullable().default(null),
  usage: z.array(z.enum(['driving-pleasure', 'daily', 'family', 'travel', 'track', 'collection'])).default([]),
  previousGenerationId: z.string().nullable().default(null),
  nextGenerationId: z.string().nullable().optional(),
  images: z.array(z.looseObject({
    commonsFile: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    caption: z.string().nullable().optional(),
    depicts: z.string(),
    isOfficial: z.boolean().default(false),
    isIllustration: z.boolean().optional(),
  })).default([]),
  editorial: z.object({
    summary: z.string(),
    positioning: z.string().nullable().default(null),
    technicalFacts: z.array(z.string()).default([]),
    pros: z.array(z.string()).default([]),
    differentiators: z.array(z.string()).default([]),
    pricePositioning: z.string().nullable().default(null),
    innovations: z.array(z.string()).default([]),
    compromises: z.array(z.string()).default([]),
  }),
  variants: z.array(variant).default([]),
  launch: z.object({
    presentation: milestone.optional(),
    ordersOpen: milestone.optional(),
    productionStart: milestone.optional(),
    firstDeliveries: milestone.optional(),
    marketAvailability: milestone.optional(),
  }).nullable().default(null),
  upcoming: z.object({
    confirmation: z.enum([
      'rumor', 'press-reported', 'official-announcement', 'official-reveal', 'orders-open',
      'launch-planned', 'on-sale', 'delayed', 'cancelled',
    ]),
    confirmed: z.array(z.string()).default([]),
    unknown: z.array(z.string()).default([]),
    expectedPowertrains: z.array(z.enum(['petrol', 'diesel', 'hybrid', 'phev', 'ev'])).nullable().default(null),
    priceStatus: z.enum(['official', 'estimate', 'not-announced']),
  }).nullable().optional(),
  changes: z.looseObject({
    previousGenerationId: z.string(),
    comparablePair: z.object({ currentVariantId: z.string(), previousVariantId: z.string() }).nullable(),
    design: z.array(z.string()).default([]),
    technology: z.array(z.string()).default([]),
    equipment: z.array(z.string()).default([]),
    chassis: z.array(z.string()).default([]),
    unchanged: z.array(z.string()).default([]),
    tradeoffs: z.array(z.string()).default([]),
    sources: z.array(source).default([]),
  }).nullable().default(null),
  sources: z.array(source).default([]),
  updatedAt: z.string(),
});

export const brandSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  founded: z.number().int().nullable(),
  accent: z.string(),
  group: z.string().nullable().optional(),
  wikidataId: z.string().regex(/^Q\d+$/).nullable().optional(),
});
