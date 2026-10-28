import type { Currency, MarketCode } from '@shared/types';
import { MARKETS } from '@shared/labels';

const NBSP = ' ';

export const marketInfo = (m: MarketCode) => MARKETS.find((x) => x.code === m) ?? MARKETS[0];

export function formatMoney(amount: number, currency: Currency, market: MarketCode = 'BE'): string {
  return new Intl.NumberFormat(marketInfo(market).locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(n: number | null | undefined, unit?: string, digits = 0): string | null {
  if (n == null) return null;
  const s = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
  return unit ? `${s}${NBSP}${unit}` : s;
}

export function formatPower(hp: number | null, kw: number | null): string | null {
  if (hp == null && kw == null) return null;
  if (hp != null && kw != null) return `${formatNumber(hp, 'ch')} (${formatNumber(kw, 'kW')})`;
  return hp != null ? formatNumber(hp, 'ch') : formatNumber(kw, 'kW');
}

/** Vitesse : km/h partout ; ajout des mph pour le Royaume-Uni (unités du marché). */
export function formatSpeed(kmh: number | null, market: MarketCode): string | null {
  if (kmh == null) return null;
  const base = formatNumber(kmh, 'km/h');
  return market === 'GB' ? `${base} (${formatNumber(Math.round(kmh / 1.609344), 'mph')})` : base;
}

export function formatLength(mm: number | null): string | null {
  if (mm == null) return null;
  return formatNumber(mm / 1000, 'm', 3);
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!iso) return 'date inconnue';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return 'date inconnue';
  return new Intl.DateTimeFormat('fr-BE', opts).format(d);
}

export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Horaire UTC converti dans le fuseau local de l'utilisateur, fuseau affiché. */
export function formatLocalDateTime(utc: string): string {
  const d = new Date(utc);
  return new Intl.DateTimeFormat('fr-BE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(d);
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const s = new Date(`${start}T12:00:00Z`);
  const e = new Date(`${end}T12:00:00Z`);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  if (sameMonth) return `${s.getUTCDate()} – ${formatDate(end)}`;
  return `${formatDate(start, { day: 'numeric', month: 'short' })} – ${formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatDate(iso, { day: 'numeric', month: 'short' });
}

/** Nombre de jours (arrondi) entre maintenant et une date. */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.ceil((Date.parse(iso) - now) / 86_400_000);
}
