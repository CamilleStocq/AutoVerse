import type { ConfirmationStatus, GenerationStatus } from '@shared/types';
import { CONFIRMATION_LABELS, STATUS_LABELS } from '@shared/labels';

const CONFIRMATION_TONE: Record<ConfirmationStatus, string> = {
  rumor: 'warning',
  'press-reported': 'warning',
  'official-announcement': 'info',
  'official-reveal': 'info',
  'orders-open': 'positive',
  'launch-planned': 'positive',
  'on-sale': 'positive',
  delayed: 'danger',
  cancelled: 'neutral',
};

const STATUS_TONE: Record<GenerationStatus, string> = {
  'on-sale': 'positive',
  racing: 'accent',
  announced: 'info',
  'in-preparation': 'warning',
  discontinued: 'neutral',
};

export function ConfirmationBadge({ status, onImage }: { status: ConfirmationStatus; onImage?: boolean }) {
  return <span className={`badge ${CONFIRMATION_TONE[status]}${onImage ? ' on-image' : ''}`}>{CONFIRMATION_LABELS[status]}</span>;
}

export function StatusBadge({ status, onImage }: { status: GenerationStatus; onImage?: boolean }) {
  return <span className={`badge ${STATUS_TONE[status]}${onImage ? ' on-image' : ''}`}>{STATUS_LABELS[status]}</span>;
}

/**
 * Badge de carte : uniquement si le statut est justifié par les données
 * (niveau de confirmation pour une nouveauté, « Plus commercialisé » pour une ancienne génération).
 */
export function CardStatus({ status, confirmation, onImage }: { status: GenerationStatus; confirmation: ConfirmationStatus | null; onImage?: boolean }) {
  if (confirmation) return <ConfirmationBadge status={confirmation} onImage={onImage} />;
  if (status === 'discontinued' || status === 'announced' || status === 'in-preparation' || status === 'racing') return <StatusBadge status={status} onImage={onImage} />;
  return null;
}
