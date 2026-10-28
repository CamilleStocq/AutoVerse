/**
 * Classification explicite et vérifiable des articles : règles par mots-clés (FR/EN),
 * reconnaissance des marques par nom exact (sensible à la casse pour éviter « mini » ≠ Mini).
 */
import type { NewsCategory } from '../../../shared/api.ts';
import type { Generation } from '../../../shared/types.ts';
import { catalog } from '../catalog/store.ts';

const BRAND_ALIASES: Record<string, string[]> = {
  'mercedes-benz': ['Mercedes', 'Mercedes-Benz', 'Mercedes-AMG', 'AMG'],
  volkswagen: ['Volkswagen', 'VW'],
  'rolls-royce': ['Rolls-Royce', 'Rolls Royce'],
  citroen: ['Citroën', 'Citroen'],
  skoda: ['Škoda', 'Skoda'],
  ds: ['DS Automobiles'],
  'land-rover': ['Land Rover', 'Range Rover', 'Defender'],
  mini: ['MINI', 'Mini Cooper'],
  'aston-martin': ['Aston Martin'],
  'alfa-romeo': ['Alfa Romeo'],
};

const RULES: Array<[NewsCategory, RegExp]> = [
  ['recalls', /\b(rappel|rappelle|recall|recalls|recalled)\b/i],
  ['regulation', /(réglementation|reglementation|norme euro|euro 7|\bloi\b|\btaxe|interdiction|regulation|\bban\b|tariff|droits de douane|\bZFE\b|malus|bonus écologique|homologation|commission européenne|european commission)/i],
  ['pricing', /(\bprix\b|\btarifs?\b|\bprice[ds]?\b|pricing|à partir de|commandes? ouvertes?|order books|€)/i],
  ['reveals', /(dévoil|devoil|présentation officielle|révél|unveil|reveal|debuts?\b|world premiere|première mondiale|\bsalon\b|motor show)/i],
  ['facelift-generation', /(restyl|facelift|nouvelle génération|new generation|next[- ]gen|refresh)/i],
  ['ev-batteries', /(électrique|electrique|\bbatter|recharge|charging|\bEVs?\b|autonomie|électrifi|kwh)/i],
  ['engines', /(\bmoteurs?\b|\bengines?\b|\bV(6|8|10|12)\b|cylindres?|powertrain|motorisation|turbo|hybride|hybrid)/i],
  ['strategy', /(stratégie|strategy|\busine\b|\bplant\b|investiss|investment|\bventes\b|\bsales\b|partenariat|partnership|\bCEO\b|\bPDG\b|emplois?|\bjobs\b|bénéfice|profit|résultats financiers|fusion|merger)/i],
  ['technology', /(logiciel|software|conduite (autonome|automatisée)|automated driving|self-driving|\bADAS\b|infodivertissement|infotainment|\bIA\b|\bAI\b|connectivité)/i],
  ['tech-innovation', /(innovation|brevet|patent|prototype|\bconcept\b|technologie inédite|breakthrough)/i],
  ['range', /(\bgamme\b|lineup|line-up|finition|\btrim\b|millésime|model year|série limitée|limited edition|édition spéciale)/i],
  ['new-models', /(\bnouveau\b|\bnouvelle\b|\bnew\b|lancement|\blaunch|arrive en|arrives)/i],
];

export function classify(title: string, summary: string): NewsCategory[] {
  const textTitle = title;
  const all = `${title} ${summary}`;
  const scored = RULES.map(([cat, re]) => ({ cat, score: (re.test(textTitle) ? 2 : 0) + (re.test(all) ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const cats = scored.slice(0, 3).map((x) => x.cat);
  return cats.length ? cats : ['other'];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let brandMatchers: Array<{ id: string; re: RegExp }> | null = null;
let modelMatchers: Array<{ brandId: string; id: string; name: string; re: RegExp }> | null = null;
let builtFor = '';

function build() {
  const state = catalog();
  if (builtFor === state.loadedAt && brandMatchers && modelMatchers) return;
  brandMatchers = [...state.brands.values()].map((b) => {
    const names = [b.name, ...(BRAND_ALIASES[b.id] ?? [])];
    return { id: b.id, re: new RegExp(`(^|[^\\p{L}\\p{N}])(${names.map(escape).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'u') };
  });
  // Un modèle est reconnu seulement si sa marque est aussi citée (évite « 3008 » isolé, etc.).
  // On le rattache à sa génération la plus récente encore commercialisée ou annoncée.
  const rank = (g: Generation) => (g.status === 'discontinued' ? 0 : 10_000) + (g.startYear ?? 0);
  const latest = new Map<string, Generation>();
  for (const g of state.generations.values()) {
    const cur = latest.get(g.modelId);
    if (!cur || rank(g) > rank(cur)) latest.set(g.modelId, g);
  }
  modelMatchers = [...latest.values()].map((g) => ({
    brandId: g.brandId,
    id: g.id,
    name: `${state.brands.get(g.brandId)?.name} ${g.modelName}`,
    re: new RegExp(`(^|[^\\p{L}\\p{N}])${escape(g.modelName)}(?=$|[^\\p{L}\\p{N}])`, 'iu'),
  }));
  builtFor = state.loadedAt;
}

export function tagEntities(title: string, summary: string, implicitBrands: string[] = []): { brands: string[]; models: Array<{ id: string; name: string }> } {
  build();
  const all = `${title} ${summary}`;
  const brands = new Set(implicitBrands);
  for (const m of brandMatchers!) if (m.re.test(all)) brands.add(m.id);
  const models = modelMatchers!
    .filter((m) => brands.has(m.brandId) && m.re.test(all))
    .map((m) => ({ id: m.id, name: m.name }));
  return { brands: [...brands], models };
}
