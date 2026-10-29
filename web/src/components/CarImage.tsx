import { useState } from 'react';
import type { ResolvedImage } from '@shared/api';

/** Silhouette neutre : jamais la photo d'un autre modèle en remplacement. */
export function CarSilhouette() {
  return (
    <svg viewBox="0 0 240 80" fill="none" aria-hidden="true">
      <path
        d="M14 58c0-6 3-9 9-10l30-6c8-9 20-18 40-20 22-2 44 0 60 8l26 13c14 1 30 4 38 8 5 2 9 6 9 12v3c0 2-2 4-4 4h-18m-150 0H20c-3 0-6-2-6-5v-7Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
      />
      <circle cx="62" cy="64" r="11" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="184" cy="64" r="11" stroke="currentColor" strokeWidth="2.5" />
      <path d="M78 64h92M86 41h86" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

/**
 * Miniature Wikimedia plus légère pour les petites cartes (500 px suffisent à l'écran d'un téléphone,
 * environ 3 fois moins lourd que la miniature de 960 px).
 */
export function cardThumb(url: string): string {
  return url.replace(/\/(\d+)px-/, (m, w) => (Number(w) > 500 ? '/500px-' : m));
}

interface Props {
  image: ResolvedImage | null;
  /** Petite carte : miniature allégée. */
  small?: boolean;
  alt: string;
  sizes?: string;
  eager?: boolean;
  large?: boolean;
  placeholderLabel?: string;
}

/** Image chargée progressivement (lazy + fondu) avec visuel de remplacement en cas d'absence ou d'erreur. */
export function CarImage({ image, alt, eager, large, small, placeholderLabel = 'Photo non disponible' }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div className="placeholder-visual" role="img" aria-label={`${alt} — ${placeholderLabel.toLowerCase()}`}>
        <CarSilhouette />
        <span>{placeholderLabel}</span>
      </div>
    );
  }
  return (
    <>
      {!loaded && <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} aria-hidden="true" />}
      <img
        src={large ? image.src : small ? cardThumb(image.thumb) : image.thumb}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={loaded ? undefined : 'img-loading'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    </>
  );
}

/** Mention d'auteur et de licence (obligatoire pour les images Wikimedia Commons). */
export function ImageCredit({ image }: { image: ResolvedImage }) {
  return (
    <span className="provenance">
      <span>Photo : {image.depicts}</span>
      {image.isIllustration && <span>· Illustration / concept, non représentatif du modèle de série</span>}
      {image.author && <span>· {image.author}</span>}
      {image.license && (
        image.pageUrl
          ? <a href={image.pageUrl} target="_blank" rel="noreferrer">· {image.license} (Wikimedia Commons)</a>
          : <span>· {image.license}</span>
      )}
    </span>
  );
}
