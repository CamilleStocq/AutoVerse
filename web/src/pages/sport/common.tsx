import { useEffect, useState } from 'react';
import type { Discipline, SportEvent } from '@shared/api';
import { Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { daysUntil, formatDateRange, formatLocalDateTime, userTimeZone } from '../../lib/format';

export const DISCIPLINES: Record<Discipline, { name: string; full: string; color: string }> = {
  f1: { name: 'F1', full: 'Formule 1', color: 'var(--f1)' },
  wec: { name: 'WEC', full: 'Championnat du monde d’endurance', color: 'var(--wec)' },
  wrc: { name: 'WRC', full: 'Championnat du monde des rallyes', color: 'var(--wrc)' },
};

export function DisciplineTag({ d }: { d: Discipline }) {
  return <span className="disc-tag" style={{ '--disc': DISCIPLINES[d].color } as React.CSSProperties}>{DISCIPLINES[d].name}</span>;
}

const STATUS: Record<SportEvent['status'], { label: string; tone: string }> = {
  upcoming: { label: 'À venir', tone: 'info' },
  live: { label: 'En cours', tone: 'accent' },
  completed: { label: 'Terminé', tone: 'neutral' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};

export function EventStatus({ status }: { status: SportEvent['status'] }) {
  return <span className={`badge ${STATUS[status].tone}`}>{STATUS[status].label}</span>;
}

export function EventCard({ event }: { event: SportEvent }) {
  const days = event.mainStartUtc ? daysUntil(event.mainStartUtc) : daysUntil(`${event.startDate}T12:00:00Z`);
  return (
    <Link to={`/sport/${event.discipline}`} className="panel event-card" style={{ '--disc': DISCIPLINES[event.discipline].color } as React.CSSProperties}>
      <div className="row between gap-2">
        <DisciplineTag d={event.discipline} />
        <EventStatus status={event.status} />
      </div>
      <div className="stack gap-1">
        <span className="subtle num" style={{ fontSize: 'var(--text-xs)' }}>{event.round ? `Manche ${event.round} · ` : ''}Saison {event.season}</span>
        <h3>{event.name}</h3>
        <span className="row gap-2 muted" style={{ fontSize: 'var(--text-sm)' }}><MapPin size={14} /> {[event.venue, event.country].filter(Boolean).join(', ')}</span>
      </div>
      <div className="event-when">
        <strong className="num">{formatDateRange(event.startDate, event.endDate)}</strong>
        {event.mainStartUtc && event.status === 'upcoming' && (
          <span className="row gap-2 muted" style={{ fontSize: 'var(--text-sm)' }}><Clock size={14} /> Départ {formatLocalDateTime(event.mainStartUtc)}</span>
        )}
        {event.status === 'upcoming' && days >= 0 && <span className="subtle num" style={{ fontSize: 'var(--text-xs)' }}>{days === 0 ? "Aujourd'hui" : `Dans ${days} jour${days > 1 ? 's' : ''}`}</span>}
      </div>
    </Link>
  );
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Compte à rebours jusqu'au départ officiel (ou au début du week-end si l'horaire n'est pas publié). */
function Countdown({ event, now }: { event: SportEvent; now: number }) {
  if (event.status === 'live') return <span className="badge accent">En cours</span>;
  const target = Date.parse(event.mainStartUtc ?? `${event.startDate}T00:00:00Z`);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return (
    <span className="race-countdown" aria-label={`Dans ${d} jours ${h} heures${event.mainStartUtc ? ` ${m} minutes` : ''}`}>
      <span><b>{String(d).padStart(2, '0')}</b>j</span>
      <span><b>{String(h).padStart(2, '0')}</b>h</span>
      {event.mainStartUtc && <span><b>{String(m).padStart(2, '0')}</b>min</span>}
    </span>
  );
}

/** Bandeau compact des prochaines épreuves, une par discipline. */
export function RaceStrip({ events }: { events: SportEvent[] }) {
  const now = useNow();
  if (!events.length) return null;
  return (
    <div className="race-strip" role="list" aria-label="Prochaines épreuves">
      {events.map((e) => (
        <Link key={e.id} role="listitem" to={`/sport/${e.discipline}`} className="race-tile" style={{ '--disc': DISCIPLINES[e.discipline].color } as React.CSSProperties}>
          <DisciplineTag d={e.discipline} />
          <span style={{ minWidth: 0 }}>
            <strong>{e.name}</strong>
            <span className="subtle num" style={{ fontSize: 12 }}>{formatDateRange(e.startDate, e.endDate)}</span>
          </span>
          <Countdown event={e} now={now} />
        </Link>
      ))}
    </div>
  );
}

export function TimezoneNote() {
  return <p className="provenance">Horaires affichés dans votre fuseau horaire ({userTimeZone()}).</p>;
}

export function SourceLinks({ sources }: { sources: Array<{ label: string; url: string; publishedAt?: string | null }> }) {
  if (!sources.length) return null;
  return (
    <details className="provenance">
      <summary style={{ cursor: 'pointer' }}>Sources ({sources.length})</summary>
      <ul className="sources" style={{ marginTop: 'var(--space-2)' }}>
        {sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
      </ul>
    </details>
  );
}
