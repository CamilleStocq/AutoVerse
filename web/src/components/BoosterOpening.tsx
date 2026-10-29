/**
 * Ouverture animée d'un booster :
 * 1. le booster fermé arrive en grand ; 2. on glisse le doigt sur le haut pour le déchirer ;
 * 3. les cartes sortent du paquet ; 4. on fait glisser chaque carte pour voir la suivante ;
 * 5. les cartes s'affichent côte à côte → « Ajouter au deck » (elles rejoignent la collection).
 * Chaque geste a un bouton équivalent (clavier, accessibilité, mouvements réduits).
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CarSummary } from '@shared/api';
import { TradingCard, RARITY } from './TradingCard';

const cardKeyOf = (c: CarSummary) => c.card?.id ?? c.id;
import { Logo } from './AppShell';

type Stage = 'arrive' | 'pack' | 'torn' | 'emerge' | 'swipe' | 'spread' | 'adding';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

interface Props {
  cards: CarSummary[];
  /** Nouvelle carte pour chaque carte du booster (les boosters ne contiennent jamais de double). */
  isNew: boolean[];
  packLabel: string;
  onAdd: () => void;
  onClose: () => void;
}

export function BoosterOpening({ cards, isNew, packLabel, onAdd, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('arrive');
  const [tear, setTear] = useState(0);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);

  useEffect(() => {
    if (stage === 'arrive') wait(650).then(() => setStage('pack'));
    if (stage === 'torn') wait(480).then(() => setStage('emerge'));
    if (stage === 'emerge') wait(900).then(() => setStage('swipe'));
  }, [stage]);

  const openPack = () => { if (stage === 'pack') { setTear(1); setStage('torn'); } };

  const nextCard = async (dir: 'left' | 'right' = 'left') => {
    if (leaving || stage !== 'swipe') return;
    setLeaving(dir);
    await wait(280);
    setLeaving(null);
    setDrag(0);
    if (index >= cards.length - 1) setStage('spread');
    else setIndex(index + 1);
  };

  const addToDeck = async () => {
    setStage('adding');
    await wait(cards.length * 90 + 650);
    onAdd();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (stage === 'pack') { e.preventDefault(); openPack(); }
        else if (stage === 'swipe') { e.preventDefault(); nextCard(e.key === 'ArrowRight' ? 'right' : 'left'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- Gestes ---
  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    start.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (start.current == null) return;
    const dx = e.clientX - start.current;
    if (stage === 'pack') setTear(Math.max(0, Math.min(1, dx / (e.currentTarget.clientWidth * 0.7))));
    if (stage === 'swipe') setDrag(dx);
  };
  const onUp = () => {
    start.current = null;
    if (stage === 'pack') {
      if (tear >= 0.6) openPack();
      else setTear(0);
    }
    if (stage === 'swipe') {
      if (Math.abs(drag) > 70) nextCard(drag > 0 ? 'right' : 'left');
      else setDrag(0);
    }
  };

  const current = cards[index];
  const rarity = current?.card?.rarity ?? 'common';

  // Rendu directement dans <body> : l'écran couvre toujours tout l'affichage, même si la page a défilé.
  return createPortal(
    <div className={`bo is-${stage}`} role="dialog" aria-modal="true" aria-label="Ouverture d'un booster">
      {(stage === 'arrive' || stage === 'pack' || stage === 'torn' || stage === 'emerge') && (
        <div className="bo-pack-zone">
          {stage === 'emerge' && (
            <div className="bo-emerging" aria-hidden="true">
              {cards.map((c, i) => <div key={i} className="bo-emerge-card" style={{ '--i': i } as CSSProperties}><TradingCard car={c} static /></div>)}
            </div>
          )}
          <div
            className="bo-pack"
            onPointerDown={stage === 'pack' ? onDown : undefined}
            onPointerMove={stage === 'pack' ? onMove : undefined}
            onPointerUp={stage === 'pack' ? onUp : undefined}
            onPointerCancel={() => { start.current = null; setTear(0); }}
          >
            <div className="bo-pack-top" style={{ '--tear': tear } as CSSProperties}>
              <span className="bo-tear-line" aria-hidden="true" />
            </div>
            <div className="bo-pack-body">
              <Logo />
              <strong>Booster</strong>
              <span>{packLabel}</span>
              <em>{cards.length} cartes</em>
            </div>
          </div>
          {stage === 'pack' && (
            <div className="bo-hint">
              <span className="bo-swipe-hint" aria-hidden="true">Glissez sur le haut du paquet pour l’ouvrir <b>⟶</b></span>
              <button type="button" className="btn btn-sm" onClick={openPack} autoFocus>Ouvrir le booster</button>
            </div>
          )}
        </div>
      )}

      {stage === 'swipe' && current && (
        <div className="bo-swipe">
          <p className="bo-counter num">Carte {index + 1} / {cards.length}</p>
          <div
            className="bo-stack"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { start.current = null; setDrag(0); }}
          >
            {/* Cartes suivantes, déjà visibles juste en dessous : la prochaine grandit pendant qu'on glisse. */}
            {cards.slice(index + 1, index + 3).map((c, k) => ({ c, depth: k + 1 })).reverse().map(({ c, depth }) => {
              const progress = depth === 1 ? (leaving ? 1 : Math.min(1, Math.abs(drag) / 140)) : 0;
              return (
                <div
                  key={`${cardKeyOf(c)}-${index + depth}`}
                  className="bo-behind"
                  style={{ '--depth': depth - progress, transition: start.current != null ? 'none' : undefined } as CSSProperties}
                  aria-hidden="true"
                >
                  <TradingCard car={c} static />
                </div>
              );
            })}
            <div
              key={index}
              className={`bo-card r-glow-${rarity}${leaving ? ` leaving-${leaving}` : ''}`}
              style={{ transform: leaving ? undefined : `translateX(${drag}px) rotate(${drag / 22}deg)`, transition: start.current != null ? 'none' : undefined }}
            >
              <TradingCard car={current} static sharp badge={isNew[index] ? 'Nouvelle !' : undefined} />
            </div>
          </div>
          <p className="bo-caption" aria-live="polite">
            <strong>{RARITY[rarity].symbol} {RARITY[rarity].label}</strong> · nouvelle carte
          </p>
          <button type="button" className="btn btn-sm" onClick={() => nextCard('left')} autoFocus>
            {index < cards.length - 1 ? 'Carte suivante' : 'Voir toutes les cartes'}
          </button>
          <p className="bo-swipe-hint subtle" aria-hidden="true">ou glissez la carte</p>
        </div>
      )}

      {(stage === 'spread' || stage === 'adding') && (
        <div className="bo-spread">
          <h2>Votre booster</h2>
          <p>{cards.length} nouvelle{cards.length > 1 ? 's' : ''} carte{cards.length > 1 ? 's' : ''}</p>
          <div className="bo-fan">
            {cards.map((c, i) => (
              <div key={`${c.id}-${i}`} className="bo-fan-card" style={{ '--i': i, '--n': cards.length } as CSSProperties}>
                <TradingCard car={c} static badge={isNew[i] ? 'Nouvelle !' : undefined} />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary bo-add" onClick={addToDeck} disabled={stage === 'adding'} autoFocus>
            {stage === 'adding' ? 'Ajout en cours…' : 'Ajouter au deck'}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
