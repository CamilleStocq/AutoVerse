/**
 * Mode « deck » : le catalogue présenté comme un paquet de cartes.
 * Glisser à droite → ajoute à la wishlist et passe à la suivante ; à gauche → suivante ;
 * toucher la carte → fiche. Boutons et flèches du clavier offrent les mêmes actions.
 * La position dans le paquet est mémorisée (reprise après fermeture de l'application).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, GitCompareArrows, Heart, RotateCcw, X } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { formatPartialDate } from '@shared/dates';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';
import { KEYS, readLocal, writeLocal } from '../state/storage';
import { CarImage } from './CarImage';
import { CardStatus } from './Badges';
import { powertrainLabel, primaryCategory } from './CarCard';
import { priceLine } from './PriceTag';

const SWIPE_THRESHOLD = 90;
const VISIBLE_BEHIND = 2;

interface Props {
  cars: CarSummary[];
  total: number;
  /** Identifie la sélection courante (filtres, tri) pour mémoriser la position par sélection. */
  deckKey: string;
  hasMore: boolean;
  loadMore: () => void;
}

type Exit = { dir: 'left' | 'right'; id: string } | null;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function CarDeck({ cars, total, deckKey, hasMore, loadMore }: Props) {
  const navigate = useNavigate();
  const { preferences, isWished, toggleWish } = useProfile();
  const { toast, isCompared, toggleCompare } = useUi();
  const [index, setIndex] = useState(() => {
    const saved = readLocal<{ key: string; index: number } | null>(KEYS.deckPosition, null);
    return saved?.key === deckKey ? saved.index : 0;
  });
  const [drag, setDrag] = useState(0);
  const [exit, setExit] = useState<Exit>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Nouvelle sélection (filtres / tri) : on repart du début, sauf position mémorisée pour celle-ci.
  const lastKey = useRef(deckKey);
  useEffect(() => {
    if (lastKey.current === deckKey) return;
    lastKey.current = deckKey;
    const saved = readLocal<{ key: string; index: number } | null>(KEYS.deckPosition, null);
    setIndex(saved?.key === deckKey ? saved.index : 0);
  }, [deckKey]);

  useEffect(() => { writeLocal(KEYS.deckPosition, { key: deckKey, index }); }, [deckKey, index]);

  // Précharge la suite du catalogue avant d'arriver au bout du paquet chargé.
  useEffect(() => {
    if (hasMore && index >= cars.length - 3) loadMore();
  }, [index, cars.length, hasMore, loadMore]);

  const current = cars[index];

  const advance = useCallback((dir: 'left' | 'right') => {
    if (!current || exit) return;
    if (dir === 'right' && !isWished(current.id)) {
      toggleWish(current);
      toast(`${current.brandName} ${current.modelName} ajoutée à votre wishlist`);
    }
    if (reducedMotion()) {
      setIndex((i) => i + 1);
      setDrag(0);
      return;
    }
    setExit({ dir, id: current.id });
    window.setTimeout(() => {
      setIndex((i) => i + 1);
      setExit(null);
      setDrag(0);
    }, 260);
  }, [current, exit, isWished, toggleWish, toast]);

  const back = useCallback(() => { if (!exit) setIndex((i) => Math.max(0, i - 1)); }, [exit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); advance('left'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.key.toLowerCase() === 'l' && current) { e.preventDefault(); advance('right'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, back, current]);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (exit || (e.target as HTMLElement).closest('button')) return;
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) > 6) start.current.moved = true;
    setDrag(dx);
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (!s.moved && current) {
      navigate(`/voiture/${current.id}`);
      return;
    }
    if (drag > SWIPE_THRESHOLD) advance('right');
    else if (drag < -SWIPE_THRESHOLD) advance('left');
    else setDrag(0);
  };

  if (!cars.length) return null;

  if (!current) {
    return (
      <div className="deck-end">
        <h3>Vous avez parcouru tout le paquet</h3>
        <p className="muted">{total} voiture{total > 1 ? 's' : ''} pour cette sélection.</p>
        <button type="button" className="btn btn-primary" onClick={() => setIndex(0)}><RotateCcw size={16} /> Recommencer</button>
      </div>
    );
  }

  const stack = cars.slice(index, index + 1 + VISIBLE_BEHIND);
  const wished = isWished(current.id);
  const intent = drag > 30 ? 'like' : drag < -30 ? 'skip' : null;

  return (
    <div className="deck">
      <div className="deck-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, ((index + 1) / Math.max(total, 1)) * 100)}%` }} /></div>
      <div className="deck-stage" role="group" aria-roledescription="paquet de cartes" aria-label={`Voiture ${index + 1} sur ${total}`}>
        {stack.slice().reverse().map((car) => {
          const depth = stack.indexOf(car);
          const isTop = depth === 0;
          const leaving = isTop && exit?.id === car.id;
          const tx = leaving ? (exit!.dir === 'right' ? 1.4 : -1.4) * window.innerWidth : isTop ? drag : 0;
          const style = {
            '--depth': depth,
            '--brand-accent': car.brandAccent,
            transform: isTop
              ? `translateX(${tx}px) rotate(${(tx / 18).toFixed(2)}deg)`
              : `translateY(${depth * 14}px) scale(${1 - depth * 0.05})`,
            transition: isTop && start.current ? 'none' : undefined,
            zIndex: 10 - depth,
          } as CSSProperties;
          return (
            <article
              key={car.id}
              className={`deck-card${isTop ? ' top' : ''}`}
              style={style}
              aria-hidden={!isTop}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? () => { start.current = null; setDrag(0); } : undefined}
            >
              <DeckFace car={car} market={preferences.market} />
              {isTop && intent && <span className={`deck-stamp ${intent}`}>{intent === 'like' ? 'Wishlist' : 'Suivante'}</span>}
            </article>
          );
        })}
      </div>

      <div className="deck-controls">
        <button type="button" className="deck-btn" onClick={back} disabled={index === 0} aria-label="Carte précédente" data-tip="Précédente (←)"><ArrowLeft size={22} /></button>
        <button type="button" className="deck-btn" onClick={() => advance('left')} aria-label="Passer à la suivante" data-tip="Suivante (→)"><X size={24} /></button>
        <button
          type="button"
          className="deck-btn primary"
          aria-pressed={wished}
          onClick={() => (wished ? (toggleWish(current), toast('Retirée de la wishlist')) : advance('right'))}
          aria-label={wished ? 'Retirer de la wishlist' : 'Ajouter à la wishlist et passer à la suivante'}
          data-tip={wished ? 'Retirer' : 'Wishlist (L)'}
        >
          <Heart size={26} fill={wished ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="deck-btn" aria-pressed={isCompared(current.id)} onClick={() => toggleCompare(current)} aria-label="Ajouter au comparateur" data-tip="Comparer"><GitCompareArrows size={22} /></button>
        <button type="button" className="deck-btn" onClick={() => advance('left')} aria-label="Carte suivante" data-tip="Suivante (→)"><ArrowRight size={22} /></button>
      </div>
      <p className="deck-hint subtle num">
        {index + 1} / {total} · Touchez la carte pour la fiche · Glissez à droite pour la wishlist, à gauche pour passer
      </p>
    </div>
  );
}

function DeckFace({ car, market }: { car: CarSummary; market: Parameters<typeof priceLine>[1] }) {
  const price = priceLine(car, market);
  const powertrain = powertrainLabel(car);
  const when = car.isUpcoming && car.releaseDate ? formatPartialDate(car.releaseDate) : car.yearsLabel;
  return (
    <>
      <div className="deck-media">
        <CarImage image={car.image} alt={`${car.brandName} ${car.modelName}`} large />
      </div>
      <div className="deck-top">
        <CardStatus status={car.status} confirmation={car.confirmation} onImage />
      </div>
      <div className="deck-info">
        <span className="eyebrow deck-brand"><i aria-hidden="true" />{car.brandName}</span>
        <h3 className="deck-title">{car.modelName}</h3>
        <p className="deck-sub">{[car.generationName, when, primaryCategory(car)].filter(Boolean).join(' · ')}</p>
        <dl className="deck-specs">
          <div><dt>{car.keyFact?.label ?? 'Motorisation'}</dt><dd>{car.keyFact?.value ?? powertrain ?? '—'}</dd></div>
          <div><dt>{price.label}</dt><dd>{price.tone === 'missing' ? 'Non communiqué' : price.value}</dd></div>
        </dl>
      </div>
    </>
  );
}
