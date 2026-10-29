/**
 * Carte à collectionner (format 63 × 88, esprit cartes Pokémon) :
 * puissance en « PV », stats d'une seule version (la carte de cette version), rareté, numéro dans la série de la marque.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CarSummary, Rarity } from '@shared/api';
import { formatNumber } from '../lib/format';
import { CarImage } from './CarImage';
import { powertrainLabel, primaryCategory } from './CarCard';
import { priceLine } from './PriceTag';
import { useProfile } from '../state/ProfileProvider';

export const RARITY: Record<Rarity, { label: string; symbol: string }> = {
  common: { label: 'Commune', symbol: '●' },
  rare: { label: 'Rare', symbol: '◆' },
  epic: { label: 'Épique', symbol: '★' },
  legendary: { label: 'Légendaire', symbol: '✦' },
};

interface Props {
  car: CarSummary;
  /** Non possédée : emplacement vide de l'album (silhouette + numéro). */
  locked?: boolean;
  count?: number;
  badge?: ReactNode;
  /** Désactive le lien vers la fiche (ex. pendant l'ouverture d'un booster). */
  static?: boolean;
  onClick?: () => void;
  /** Carte affichée en grand (ouverture de booster) : photo en meilleure définition. */
  sharp?: boolean;
}

export function TradingCard({ car, locked, count, badge, static: isStatic, onClick, sharp }: Props) {
  const { preferences } = useProfile();
  const card = car.card;
  const rarity = card?.rarity ?? 'common';
  const style = { '--brand-accent': car.brandAccent } as CSSProperties;
  const number = card ? `#${String(card.number).padStart(3, '0')}/${String(card.setSize).padStart(3, '0')}` : '';

  if (locked) {
    return (
      <div className="tcard locked" style={style} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
        <div className="tcard-inner">
          <div className="tcard-locked-mark" aria-hidden="true">?</div>
          <span className="tcard-locked-name">{car.modelName}</span>
          <span className="tcard-locked-num">{car.brandName} · {number}</span>
          <span className="tcard-rarity" aria-label={`Rareté : ${RARITY[rarity].label}`}>{RARITY[rarity].symbol}</span>
        </div>
      </div>
    );
  }

  const stats: Array<[string, string]> = [];
  if (card?.accel0100s != null) stats.push(['0 → 100 km/h', `${formatNumber(card.accel0100s, 's', 1)}`]);
  if (card?.topSpeedKmh != null) stats.push(['Vitesse max', formatNumber(card.topSpeedKmh, 'km/h')!]);
  if (card?.electricRangeKm != null) stats.push(['Autonomie', formatNumber(card.electricRangeKm, 'km')!]);
  else if (card?.torqueNm != null) stats.push(['Couple', formatNumber(card.torqueNm, 'Nm')!]);
  const price = priceLine(car, preferences.market);

  const body = (
    <div className="tcard-inner">
      <header className="tcard-head">
        <span className="tcard-name">{car.modelName}</span>
        <span className="tcard-hp">{card?.powerHp != null ? <>{card.powerHp}<small>ch</small></> : <small>— ch</small>}</span>
      </header>
      <span className="tcard-sub">{card?.variantName ? `${card.variantName} · ${car.generationName}` : `${car.brandName} · ${car.generationName}`}</span>
      <div className="tcard-art">
        <CarImage image={car.image} small={!sharp} alt={`${car.brandName} ${car.modelName}`} placeholderLabel="" />
      </div>
      <div className="tcard-types">
        {[primaryCategory(car), powertrainLabel(car)].filter(Boolean).map((t) => <span key={t}>{t}</span>)}
      </div>
      <dl className="tcard-stats">
        {stats.slice(0, 3).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        <div><dt>{price.tone === 'missing' ? 'Prix' : price.label}</dt><dd>{price.tone === 'missing' ? 'non communiqué' : price.value}</dd></div>
      </dl>
      {card?.teaser && <p className="tcard-flavor">{card.teaser}</p>}
      <footer className="tcard-foot">
        <span>{number}</span>
        <span className="tcard-rarity">{RARITY[rarity].symbol} {RARITY[rarity].label}</span>
      </footer>
      {count != null && count > 1 && <span className="tcard-count">×{count}</span>}
      {badge && <span className="tcard-badge">{badge}</span>}
    </div>
  );

  const className = `tcard r-${rarity}`;
  if (isStatic || onClick) {
    return <div className={className} style={style} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>{body}</div>;
  }
  return <Link to={`/voiture/${car.id}`} className={className} style={style} aria-label={`${car.brandName} ${car.modelName}, carte ${RARITY[rarity].label}`}>{body}</Link>;
}
