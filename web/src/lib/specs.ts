/** Définition unique des caractéristiques affichées (fiche, versions, comparateur, évolution). */
import type { MarketCode, Variant } from '@shared/types';
import { DRIVETRAIN_LABELS, POWERTRAIN_LABELS, PRICE_TYPE_LABELS } from '@shared/labels';
import { formatDate, formatLength, formatMoney, formatNumber, formatPower, formatSpeed } from './format';

export interface SpecDef {
  key: string;
  label: string;
  group: 'Motorisation' | 'Performances' | 'Consommation et énergie' | 'Gabarit et pratique' | 'Prix';
  /** Valeur numérique comparable (null si absente). */
  value?: (v: Variant, market: MarketCode) => number | null;
  unit?: string;
  display: (v: Variant, market: MarketCode) => string | null;
  /** Sens dans lequel une hausse est un « plus » factuel (sinon neutre). Utilisé uniquement pour colorer un écart. */
  higherIs?: 'more' | 'less';
}

function marketPrice(v: Variant, market: MarketCode) {
  const p = v.prices.filter((x) => x.market === market && x.type !== 'estimate');
  return p.length ? p.reduce((a, b) => (b.amount < a.amount ? b : a)) : null;
}

export const SPECS: SpecDef[] = [
  { key: 'powertrain', label: 'Type de motorisation', group: 'Motorisation', display: (v) => POWERTRAIN_LABELS[v.powertrain] },
  { key: 'architecture', label: 'Architecture', group: 'Motorisation', display: (v) => v.engine.architecture },
  { key: 'displacement', label: 'Cylindrée', group: 'Motorisation', value: (v) => v.engine.displacementCc, unit: 'cm³', display: (v) => formatNumber(v.engine.displacementCc, 'cm³') },
  { key: 'power', label: 'Puissance', group: 'Motorisation', value: (v) => v.powerHp, unit: 'ch', display: (v) => formatPower(v.powerHp, v.powerKw), higherIs: 'more' },
  { key: 'torque', label: 'Couple', group: 'Motorisation', value: (v) => v.torqueNm, unit: 'Nm', display: (v) => formatNumber(v.torqueNm, 'Nm'), higherIs: 'more' },
  { key: 'drivetrain', label: 'Transmission', group: 'Motorisation', display: (v) => (v.drivetrain ? DRIVETRAIN_LABELS[v.drivetrain] : null) },
  { key: 'gearbox', label: 'Boîte de vitesses', group: 'Motorisation', display: (v) => v.gearbox },
  { key: 'accel', label: '0 à 100 km/h', group: 'Performances', value: (v) => v.accel0100s, unit: 's', display: (v) => formatNumber(v.accel0100s, 's', 1), higherIs: 'less' },
  { key: 'vmax', label: 'Vitesse maximale', group: 'Performances', value: (v) => v.topSpeedKmh, unit: 'km/h', display: (v, m) => formatSpeed(v.topSpeedKmh, m), higherIs: 'more' },
  { key: 'consumption', label: 'Consommation mixte', group: 'Consommation et énergie', value: (v) => v.consumption?.value ?? null, display: (v) => (v.consumption ? `${formatNumber(v.consumption.value, v.consumption.unit, 1)} (${v.consumption.cycle})` : null), higherIs: 'less' },
  { key: 'range', label: 'Autonomie électrique (WLTP)', group: 'Consommation et énergie', value: (v) => v.electricRangeKm, unit: 'km', display: (v) => formatNumber(v.electricRangeKm, 'km'), higherIs: 'more' },
  { key: 'battery', label: 'Capacité de batterie', group: 'Consommation et énergie', value: (v) => v.batteryKwh, unit: 'kWh', display: (v) => formatNumber(v.batteryKwh, 'kWh', 1) },
  { key: 'charging', label: 'Recharge rapide (DC)', group: 'Consommation et énergie', value: (v) => v.charging?.dcMaxKw ?? null, display: (v) => {
    if (!v.charging || (v.charging.dcMaxKw == null && v.charging.dc10to80Min == null)) return null;
    return [v.charging.dcMaxKw != null ? `jusqu'à ${formatNumber(v.charging.dcMaxKw, 'kW')}` : null, v.charging.dc10to80Min != null ? `10 → 80 % en ${v.charging.dc10to80Min} min` : null].filter(Boolean).join(' · ');
  } },
  { key: 'co2', label: 'Émissions de CO₂ (WLTP)', group: 'Consommation et énergie', value: (v) => v.co2Gkm, unit: 'g/km', display: (v) => formatNumber(v.co2Gkm, 'g/km'), higherIs: 'less' },
  { key: 'weight', label: 'Poids', group: 'Gabarit et pratique', value: (v) => v.weightKg, unit: 'kg', display: (v) => formatNumber(v.weightKg, 'kg') },
  { key: 'length', label: 'Longueur', group: 'Gabarit et pratique', value: (v) => v.dimensions?.lengthMm ?? null, unit: 'mm', display: (v) => formatLength(v.dimensions?.lengthMm ?? null) },
  { key: 'width', label: 'Largeur', group: 'Gabarit et pratique', value: (v) => v.dimensions?.widthMm ?? null, unit: 'mm', display: (v) => formatLength(v.dimensions?.widthMm ?? null) },
  { key: 'height', label: 'Hauteur', group: 'Gabarit et pratique', value: (v) => v.dimensions?.heightMm ?? null, unit: 'mm', display: (v) => formatLength(v.dimensions?.heightMm ?? null) },
  { key: 'wheelbase', label: 'Empattement', group: 'Gabarit et pratique', value: (v) => v.dimensions?.wheelbaseMm ?? null, unit: 'mm', display: (v) => formatLength(v.dimensions?.wheelbaseMm ?? null) },
  { key: 'seats', label: 'Places', group: 'Gabarit et pratique', value: (v) => v.seats, display: (v) => (v.seats != null ? String(v.seats) : null) },
  { key: 'trunk', label: 'Volume du coffre', group: 'Gabarit et pratique', value: (v) => v.trunkL, unit: 'l', display: (v) => formatNumber(v.trunkL, 'l'), higherIs: 'more' },
  { key: 'price', label: 'Prix', group: 'Prix', value: (v, m) => marketPrice(v, m)?.amount ?? null, unit: '€', display: (v, m) => {
    const p = marketPrice(v, m);
    return p ? `${formatMoney(p.amount, p.currency, m)} (${PRICE_TYPE_LABELS[p.type].toLowerCase()}, au ${formatDate(p.asOf, { month: 'short', year: 'numeric' })})` : null;
  } },
];

export const SPEC_GROUPS = ['Motorisation', 'Performances', 'Consommation et énergie', 'Gabarit et pratique', 'Prix'] as const;

export function specByKey(key: string): SpecDef {
  return SPECS.find((s) => s.key === key)!;
}

/** Écart chiffré lisible : « +20 ch », « −0,3 s ». */
export function formatDelta(a: number, b: number, unit?: string, digits = 1): string {
  const d = a - b;
  const s = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: Math.abs(d) < 10 ? digits : 0, signDisplay: 'exceptZero' }).format(d).replace('-', '−');
  return unit ? `${s} ${unit}` : s;
}
