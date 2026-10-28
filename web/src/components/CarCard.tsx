import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import type { CarSummary } from '@shared/api';
import { CATEGORY_SHORT, POWERTRAIN_LABELS } from '@shared/labels';
import { formatPartialDate } from '@shared/dates';
import { useProfile } from '../state/ProfileProvider';
import { CarImage } from './CarImage';
import { CompareButton, HeartButton } from './CarActions';
import { CardStatus } from './Badges';
import { priceLine } from './PriceTag';

const BODY_FIRST = ['supercar', 'sport-suv', 'sport-sedan', 'gt', 'sports', 'coupe', 'convertible', 'suv', 'wagon', 'compact', 'city', 'family-sedan', 'offroad', 'luxury', 'classic'] as const;

export function primaryCategory(car: CarSummary): string | null {
  const c = BODY_FIRST.find((k) => car.categories.includes(k));
  return c ? CATEGORY_SHORT[c] : null;
}

export function powertrainLabel(car: CarSummary): string | null {
  if (!car.powertrains.length) return null;
  return car.powertrains.map((p) => POWERTRAIN_LABELS[p]).join(' · ');
}

/** Préfixe indiquant QUELLE étape la date désigne (présentation ≠ commercialisation). */
const RELEASE_PREFIX: Record<NonNullable<CarSummary['releaseDateKind']>, string> = {
  presentation: 'Présentation',
  ordersOpen: 'Commandes',
  firstDeliveries: 'Livraisons',
  marketAvailability: 'En vente',
};

interface Props { car: CarSummary; eager?: boolean; reason?: string }

export function CarCard({ car, eager, reason }: Props) {
  const { preferences } = useProfile();
  const price = priceLine(car, preferences.market);
  const category = primaryCategory(car);
  const powertrain = powertrainLabel(car);
  const name = `${car.brandName} ${car.modelName}`;
  return (
    <article className="car-card" style={{ '--brand-accent': car.brandAccent } as CSSProperties}>
      <div className="car-media">
        <CarImage image={car.image} alt={`${name} ${car.generationName}`} eager={eager} />
        <div className="car-media-top">
          <CardStatus status={car.status} confirmation={car.confirmation} onImage />
          <div className="car-media-actions">
            <CompareButton car={car} onImage size={18} />
            <HeartButton car={car} onImage size={18} />
          </div>
        </div>
      </div>
      <div className="car-body">
        <div className="car-brand">
          <i aria-hidden="true" />
          <span className="eyebrow">{car.brandName}</span>
        </div>
        <h3 className="car-title">
          <Link to={`/voiture/${car.id}`}>{car.modelName}</Link>
        </h3>
        <p className="car-gen">
          {[car.generationName, car.isUpcoming && car.releaseDate && car.releaseDateKind ? RELEASE_PREFIX[car.releaseDateKind] + ' : ' + formatPartialDate(car.releaseDate) : car.yearsLabel, category].filter(Boolean).join(' · ')}
        </p>
        {reason && <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>{reason}</p>}
        <dl className="car-foot">
          <div className="kv">
            <dt>{car.keyFact?.label ?? 'Motorisation'}</dt>
            <dd>{car.keyFact?.value ?? powertrain ?? 'Non communiquée'}</dd>
            {car.keyFact && powertrain && <dd className="subtle" style={{ fontWeight: 500, fontSize: 'var(--text-xs)' }}>{powertrain}</dd>}
          </div>
          <div className="kv right">
            <dt>{price.label}</dt>
            <dd style={price.tone === 'missing' ? { color: 'var(--text-subtle)', fontWeight: 500 } : undefined}>{price.value}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/** Ligne compacte : balayage rapide d'un grand nombre de modèles (vue liste d'Explorer). */
export function CarRow({ car }: { car: CarSummary }) {
  const { preferences } = useProfile();
  const price = priceLine(car, preferences.market);
  const powertrain = powertrainLabel(car);
  const date = car.isUpcoming && car.releaseDate && car.releaseDateKind
    ? `${RELEASE_PREFIX[car.releaseDateKind]} : ${formatPartialDate(car.releaseDate)}` : car.yearsLabel;
  return (
    <article className="car-row" style={{ '--brand-accent': car.brandAccent } as CSSProperties}>
      <div className="car-row-media"><CarImage image={car.image} alt="" placeholderLabel="" /></div>
      <div className="car-row-main">
        <span className="eyebrow">{car.brandName}</span>
        <h3><Link to={`/voiture/${car.id}`}>{car.modelName}</Link></h3>
        <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>{[car.generationName, date, primaryCategory(car)].filter(Boolean).join(' · ')}</span>
        {(car.confirmation || car.status !== 'on-sale') && <span><CardStatus status={car.status} confirmation={car.confirmation} /></span>}
      </div>
      <dl className="car-row-specs">
        <div className="kv"><dt>{car.keyFact?.label ?? 'Motorisation'}</dt><dd>{car.keyFact?.value ?? powertrain ?? '—'}</dd></div>
        <div className="kv"><dt>{price.label}</dt><dd style={price.tone === 'missing' ? { color: 'var(--text-subtle)', fontWeight: 500 } : undefined}>{price.tone === 'missing' ? 'Non communiqué' : price.value}</dd></div>
      </dl>
      <div className="car-row-actions">
        <CompareButton car={car} size={18} />
        <HeartButton car={car} size={18} />
      </div>
    </article>
  );
}

export function CarCardSkeleton() {
  return (
    <div className="car-card" aria-hidden="true">
      <div className="car-media"><div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} /></div>
      <div className="car-body">
        <div className="skeleton" style={{ height: 12, width: '30%' }} />
        <div className="skeleton" style={{ height: 24, width: '60%' }} />
        <div className="skeleton" style={{ height: 14, width: '45%' }} />
        <div className="skeleton" style={{ height: 38, marginTop: 12 }} />
      </div>
    </div>
  );
}
