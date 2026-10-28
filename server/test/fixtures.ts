import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const source = { label: 'Constructeur', url: 'https://example.com/press', type: 'manufacturer', retrievedAt: '2026-10-28' };

export function variant(id: string, over: Record<string, unknown> = {}) {
  return {
    id, name: id, tier: 'entry', powertrain: 'petrol',
    engine: { architecture: null, displacementCc: null },
    powerHp: 300, powerKw: 221, torqueNm: 400, drivetrain: 'rwd', gearbox: null,
    accel0100s: 5, topSpeedKmh: 250, consumption: null, electricRangeKm: null, batteryKwh: null,
    charging: null, co2Gkm: null, weightKg: null, dimensions: { lengthMm: 4500, widthMm: null, heightMm: null, wheelbaseMm: null },
    seats: 4, trunkL: null, equipmentHighlights: [], prices: [], sources: [source],
    ...over,
  };
}

export function generation(id: string, over: Record<string, unknown> = {}) {
  return {
    id, modelId: id.split('-').slice(0, 2).join('-'), brandId: 'porsche', modelName: id, name: 'gen', yearsLabel: '2024 –',
    startYear: 2024, endYear: null, status: 'on-sale', segment: 'S', bodyStyles: ['Coupé'], categories: ['sports', 'coupe'],
    priceRange: 'luxury', usage: ['driving-pleasure'], previousGenerationId: null, images: [],
    editorial: { summary: 'Résumé', positioning: null, technicalFacts: [], pros: [], differentiators: [], pricePositioning: null, innovations: [], compromises: [] },
    variants: [variant(`${id}-base`)], launch: null, upcoming: null, changes: null, sources: [source], updatedAt: '2026-10-28',
    ...over,
  };
}

/** Crée un dossier seed temporaire contenant les fichiers fournis. */
export function seedDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'autoverse-seed-'));
  const all = {
    'brands.json': { brands: [
      { id: 'porsche', name: 'Porsche', country: 'Allemagne', founded: 1931, accent: '#b12b28' },
      { id: 'bmw', name: 'BMW', country: 'Allemagne', founded: 1916, accent: '#1c69d4' },
    ] },
    ...files,
  };
  for (const [name, content] of Object.entries(all)) writeFileSync(path.join(dir, name), JSON.stringify(content));
  return dir;
}

export const testSource = source;
