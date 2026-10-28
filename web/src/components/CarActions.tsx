import { GitCompareArrows, Heart, Share2 } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';

interface Props { car: CarSummary; onImage?: boolean; size?: number }

export function HeartButton({ car, onImage, size = 20 }: Props) {
  const { isWished, toggleWish } = useProfile();
  const { toast } = useUi();
  const wished = isWished(car.id);
  const label = wished ? 'Retirer de la wishlist' : 'Ajouter à la wishlist';
  return (
    <button
      type="button"
      className={`icon-btn heart${onImage ? ' on-image' : ''}`}
      aria-pressed={wished}
      aria-label={`${label} : ${car.brandName} ${car.modelName}`}
      data-tip={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggleWish(car);
        toast(added ? `${car.brandName} ${car.modelName} ajoutée à votre wishlist` : 'Retirée de la wishlist');
      }}
    >
      <Heart size={size} strokeWidth={2} />
    </button>
  );
}

export function CompareButton({ car, onImage, size = 20 }: Props) {
  const { isCompared, toggleCompare } = useUi();
  const active = isCompared(car.id);
  const label = active ? 'Retirer du comparateur' : 'Ajouter au comparateur';
  return (
    <button
      type="button"
      className={`icon-btn compare-toggle${onImage ? ' on-image' : ''}`}
      aria-pressed={active}
      aria-label={`${label} : ${car.brandName} ${car.modelName}`}
      data-tip={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(car);
      }}
    >
      <GitCompareArrows size={size} strokeWidth={2} />
    </button>
  );
}

export function ShareButton({ car, onImage, size = 20 }: Props) {
  const { toast } = useUi();
  const share = async () => {
    const url = `${window.location.origin}/voiture/${car.id}`;
    const title = `${car.brandName} ${car.modelName} ${car.generationName}`.trim();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Lien de la fiche copié');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast('Partage impossible sur cet appareil');
    }
  };
  return (
    <button
      type="button"
      className={`icon-btn${onImage ? ' on-image' : ''}`}
      aria-label={`Partager la fiche ${car.brandName} ${car.modelName}`}
      data-tip="Partager"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        share();
      }}
    >
      <Share2 size={size} strokeWidth={2} />
    </button>
  );
}
