import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert, Clock, Info, SearchX } from 'lucide-react';
import { CarCardSkeleton } from './CarCard';
import { formatDate, timeAgo } from '../lib/format';

export function CardGridSkeleton({ count = 6, rail }: { count?: number; rail?: boolean }) {
  return (
    <div className={rail ? 'rail' : 'card-grid'} aria-busy="true" aria-label="Chargement en cours">
      {Array.from({ length: count }, (_, i) => <CarCardSkeleton key={i} />)}
    </div>
  );
}

export function ErrorState({ title = 'Contenu momentanément indisponible', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <CircleAlert size={28} />
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && <button type="button" className="btn btn-sm" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="state">
      {icon ?? <SearchX size={28} />}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

/** Fraîcheur des données externes : date de récupération et avertissement si copie de secours. */
export function Freshness({ fetchedAt, stale, errors, label = 'Données récupérées' }: { fetchedAt?: string; stale?: boolean; errors?: string[]; label?: string }) {
  return (
    <div className="stack gap-2">
      {fetchedAt && (
        <span className="provenance" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
          <Clock size={12} aria-hidden="true" style={{ flex: 'none', alignSelf: 'center' }} />
          <span>{label} {timeAgo(fetchedAt)} ({formatDate(fetchedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})</span>
        </span>
      )}
      {stale && (
        <div className="notice warning"><CircleAlert size={16} /> La source ne répond pas : la dernière copie connue est affichée.</div>
      )}
      {!!errors?.length && !stale && (
        <details className="provenance">
          <summary style={{ cursor: 'pointer' }}>{errors.length} source(s) momentanément indisponible(s)</summary>
          <ul style={{ listStyle: 'none', marginTop: 4 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return <div className={`notice ${tone}`}>{tone === 'warning' ? <CircleAlert size={16} /> : <Info size={16} />}<div>{children}</div></div>;
}

export function Section({ title, subtitle, to, linkLabel = 'Tout voir', children, id }: { title: string; subtitle?: string; to?: string; linkLabel?: string; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {to && <Link to={to} className="section-link">{linkLabel} <ArrowRight size={16} /></Link>}
      </div>
      {children}
    </section>
  );
}
