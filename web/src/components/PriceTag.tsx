import type { PriceView } from '@shared/api';
import type { MarketCode } from '@shared/types';
import { PRICE_TYPE_LABELS } from '@shared/labels';
import { formatDate, formatMoney, marketInfo } from '../lib/format';

/**
 * Valeur de prix pour une carte, par ordre de fiabilité :
 * prix vérifié du marché choisi → prix vérifié d'un autre marché (nommé) → estimation presse → « non communiqué ».
 * Une estimation n'est jamais présentée comme officielle.
 */
export function priceLine(
  car: { startingPrice: PriceView | null; estimatedPrice: PriceView | null; otherMarketPrice?: PriceView | null },
  market: MarketCode,
): { label: string; value: string; tone?: 'estimate' | 'missing' | 'other-market' } {
  const { startingPrice: price, estimatedPrice: estimate, otherMarketPrice: other } = car;
  if (price) {
    const prefix = price.type === 'range-start' ? 'dès ' : '';
    return { label: PRICE_TYPE_LABELS[price.type], value: `${prefix}${formatMoney(price.amount, price.currency, market)}` };
  }
  if (other) {
    const prefix = other.type === 'range-start' ? 'dès ' : '';
    return {
      label: `${PRICE_TYPE_LABELS[other.type]} · ${marketInfo(other.market).name}`,
      value: `${prefix}${formatMoney(other.amount, other.currency, other.market)}`,
      tone: 'other-market',
    };
  }
  if (estimate?.estimate) {
    return {
      label: 'Estimation presse',
      value: `${formatMoney(estimate.estimate.low, estimate.currency, market)} – ${formatMoney(estimate.estimate.high, estimate.currency, market)}`,
      tone: 'estimate',
    };
  }
  return { label: 'Prix', value: `Non communiqué (${marketInfo(market).name})`, tone: 'missing' };
}

const CONFIDENCE = { low: 'faible', medium: 'moyenne', high: 'élevée' } as const;

/** Bloc détaillé : type de prix, marché, version, date et source. */
export function PriceDetail({ price, market }: { price: PriceView; market: MarketCode }) {
  return (
    <div className="stack gap-1">
      <span className="eyebrow">{PRICE_TYPE_LABELS[price.type]} · {marketInfo(price.market).name}</span>
      <strong className="display num" style={{ fontSize: 'var(--text-2xl)' }}>
        {price.type === 'estimate' && price.estimate
          ? `${formatMoney(price.estimate.low, price.currency, market)} – ${formatMoney(price.estimate.high, price.currency, market)}`
          : `${price.type === 'range-start' ? 'dès ' : ''}${formatMoney(price.amount, price.currency, market)}`}
      </strong>
      <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        Version : {price.variantName} · Prix TTC au {formatDate(price.asOf)}
        {price.type === 'estimate' && price.estimate && ` · Incertitude ${CONFIDENCE[price.estimate.confidence]}`}
      </span>
      <a className="subtle" style={{ fontSize: 'var(--text-xs)', textDecoration: 'underline' }} href={price.source.url} target="_blank" rel="noreferrer">
        Source : {price.source.label}
      </a>
    </div>
  );
}
