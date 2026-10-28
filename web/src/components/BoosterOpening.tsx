/**
 * Ouverture d'un booster : le paquet → 5 cartes face cachée → révélation une à une → récapitulatif.
 * Les cartes sont déjà enregistrées dans la collection au moment de l'ouverture.
 */
import { useEffect, useState } from 'react';
import type { CarSummary } from '@shared/api';
import { TradingCard, RARITY } from './TradingCard';
import { Logo } from './AppShell';

export interface DrawnCard { car: CarSummary; isNew: boolean }

export function BoosterOpening({ cards, packLabel, onClose }: { cards: DrawnCard[]; packLabel: string; onClose: () => void }) {
  const [stage, setStage] = useState<'pack' | 'reveal' | 'summary'>('pack');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const current = cards[index];
  const next = () => {
    if (!flipped) { setFlipped(true); return; }
    if (index < cards.length - 1) { setIndex(index + 1); setFlipped(false); return; }
    setStage('summary');
  };

  return (
    <div className="booster-overlay" role="dialog" aria-modal="true" aria-label="Ouverture d'un booster">
      {stage === 'pack' && (
        <button type="button" className="booster-pack" onClick={() => setStage('reveal')} autoFocus>
          <span className="booster-pack-top" aria-hidden="true" />
          <Logo />
          <strong>Booster</strong>
          <span>{packLabel}</span>
          <em>{cards.length} cartes · touchez pour ouvrir</em>
        </button>
      )}

      {stage === 'reveal' && current && (
        <div className="booster-reveal">
          <p className="booster-progress num">Carte {index + 1} / {cards.length}</p>
          <button type="button" className={`flip${flipped ? ' is-flipped' : ''}`} onClick={next} aria-label={flipped ? 'Carte suivante' : 'Retourner la carte'} autoFocus>
            <span className="flip-face flip-back" aria-hidden={flipped}><CardBack /></span>
            <span className="flip-face flip-front" aria-hidden={!flipped}>
              <TradingCard car={current.car} static badge={current.isNew ? 'Nouvelle !' : undefined} />
            </span>
          </button>
          <p className="booster-caption" aria-live="polite">
            {flipped
              ? <>{current.isNew ? 'Nouvelle carte' : 'Double'} · <strong>{RARITY[current.car.card?.rarity ?? 'common'].label}</strong> — touchez pour continuer</>
              : 'Touchez la carte pour la retourner'}
          </p>
        </div>
      )}

      {stage === 'summary' && (
        <div className="booster-summary">
          <h2>Booster ouvert</h2>
          <p className="muted">{cards.filter((c) => c.isNew).length} nouvelle(s) carte(s) ajoutée(s) à votre collection.</p>
          <div className="tcard-grid booster-grid">
            {cards.map((c, i) => <TradingCard key={`${c.car.id}-${i}`} car={c.car} static badge={c.isNew ? 'Nouvelle !' : undefined} />)}
          </div>
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>Ranger dans mon album</button>
        </div>
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="tcard tcard-back" aria-hidden="true">
      <div className="tcard-inner">
        <Logo />
        <strong>Autoverse</strong>
      </div>
    </div>
  );
}
