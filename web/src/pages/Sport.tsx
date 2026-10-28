import { useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import type { Discipline } from '@shared/api';
import { useSportCalendar } from '../hooks/queries';
import { ErrorState, Freshness } from '../components/States';
import { DISCIPLINES, EventCard, TimezoneNote } from './sport/common';
import { F1Page } from './sport/F1';
import { WecPage, WrcPage } from './sport/Series';
import { daysUntil } from '../lib/format';

type Period = 'all' | 'upcoming' | '30d' | 'past';

function CalendarPage() {
  const cal = useSportCalendar();
  const [disc, setDisc] = useState<Discipline[]>([]);
  const [period, setPeriod] = useState<Period>('upcoming');
  const seasons = useMemo(() => [...new Set(cal.data?.data.map((e) => e.season) ?? [])].sort(), [cal.data]);
  const [season, setSeason] = useState<number | 'all'>('all');
  const events = (cal.data?.data ?? []).filter((e) => {
    if (disc.length && !disc.includes(e.discipline)) return false;
    if (season !== 'all' && e.season !== season) return false;
    const d = daysUntil(`${e.endDate}T23:59:59Z`);
    if (period === 'upcoming') return e.status === 'upcoming' || e.status === 'live';
    if (period === '30d') return (e.status === 'upcoming' || e.status === 'live') && d <= 30;
    if (period === 'past') return e.status === 'completed' || e.status === 'cancelled';
    return true;
  });
  const ordered = period === 'past' ? [...events].reverse() : events;
  return (
    <div className="stack gap-5">
      <div className="row gap-3 wrap">
        <div className="chip-row" role="group" aria-label="Discipline">
          {(Object.keys(DISCIPLINES) as Discipline[]).map((d) => (
            <button key={d} type="button" className="chip" aria-pressed={disc.includes(d)} onClick={() => setDisc(disc.includes(d) ? disc.filter((x) => x !== d) : [...disc, d])}>{DISCIPLINES[d].name}</button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Période">
          {([['upcoming', 'À venir'], ['30d', '30 jours'], ['past', 'Passés'], ['all', 'Tout']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
        {seasons.length > 1 && (
          <label className="row gap-2"><span className="sr-only">Saison</span>
            <select className="select" style={{ width: 'auto' }} value={season} onChange={(e) => setSeason(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">Toutes les saisons</option>{seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
      <TimezoneNote />
      {cal.isLoading && <div className="skeleton" style={{ height: 300 }} />}
      {cal.isError && <ErrorState message="Le calendrier est momentanément indisponible." onRetry={() => cal.refetch()} />}
      {cal.data && (ordered.length
        ? <div className="event-grid">{ordered.map((e) => <EventCard key={e.id} event={e} />)}</div>
        : <p className="muted">Aucune épreuve pour ces filtres.</p>)}
      {cal.data && <Freshness fetchedAt={cal.data.fetchedAt} stale={cal.data.stale} errors={cal.data.errors} label="Calendrier F1 récupéré" />}
    </div>
  );
}

export function Sport() {
  return (
    <div className="page-enter">
      <header className="page-head sport-head">
        <span className="eyebrow">Sport automobile</span>
        <h1>Formule 1, Endurance, Rallye</h1>
        <p>Résultats officiels datés, classements par saison et par catégorie, calendrier dans votre fuseau horaire.</p>
      </header>
      <nav className="tabs" aria-label="Disciplines" style={{ marginBottom: 'var(--space-6)' }}>
        <NavLink to="/sport" end>Calendrier</NavLink>
        <NavLink to="/sport/f1" style={{ '--tab-accent': 'var(--f1)' } as React.CSSProperties}>Formule 1</NavLink>
        <NavLink to="/sport/wec" style={{ '--tab-accent': 'var(--wec)' } as React.CSSProperties}>WEC</NavLink>
        <NavLink to="/sport/wrc" style={{ '--tab-accent': 'var(--wrc)' } as React.CSSProperties}>WRC</NavLink>
      </nav>
      <Routes>
        <Route index element={<CalendarPage />} />
        <Route path="f1" element={<F1Page />} />
        <Route path="wec" element={<WecPage />} />
        <Route path="wrc" element={<WrcPage />} />
      </Routes>
    </div>
  );
}
