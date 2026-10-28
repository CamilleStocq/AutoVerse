import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { isWithinWindow, releaseWindow, type ReleaseWindow } from '@shared/dates';
import { CONFIRMATION_LABELS, isUnconfirmed } from '@shared/labels';
import type { ConfirmationStatus } from '@shared/types';
import { useCars } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { CarCard } from '../components/CarCard';
import { CardGridSkeleton, EmptyState, ErrorState, Notice } from '../components/States';
import { formatDate, marketInfo } from '../lib/format';

const WINDOWS: Array<{ id: ReleaseWindow | 'all'; label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'soon', label: 'Prochainement (30 j)' },
  { id: '3m', label: '3 mois' },
  { id: '6m', label: '6 mois' },
  { id: '12m', label: '12 mois' },
  { id: 'unknown', label: 'Date inconnue' },
];

const GROUP_LABEL: Record<ReleaseWindow, string> = {
  past: 'Déjà arrivées sur le marché',
  soon: 'Dans les 30 prochains jours',
  '3m': 'Dans les 3 prochains mois',
  '6m': 'Dans les 6 prochains mois',
  '12m': 'Dans les 12 prochains mois',
  later: 'Plus tard',
  unknown: 'Date de sortie inconnue',
};
const GROUP_ORDER: ReleaseWindow[] = ['soon', '3m', '6m', '12m', 'later', 'unknown', 'past'];

export function Upcoming() {
  const { preferences } = useProfile();
  const cars = useCars({ status: ['upcoming'], sort: 'release', pageSize: 100 });
  const [win, setWin] = useState<ReleaseWindow | 'all'>('all');
  const [conf, setConf] = useState<'all' | 'confirmed'>('all');
  const now = useMemo(() => new Date(), []);

  const { confirmed, rumors, cancelled } = useMemo(() => {
    const items = cars.data?.items ?? [];
    const withWin = items.map((c) => ({ c, w: releaseWindow(c.releaseDate, now) }));
    const pass = (x: { w: ReleaseWindow }) => win === 'all' || isWithinWindow(x.w, win);
    return {
      confirmed: withWin.filter((x) => !isUnconfirmed(x.c.confirmation) && x.c.confirmation !== 'cancelled' && pass(x)),
      rumors: withWin.filter((x) => isUnconfirmed(x.c.confirmation) && pass(x)),
      cancelled: items.filter((c) => c.confirmation === 'cancelled'),
    };
  }, [cars.data, win, now]);

  const groups = GROUP_ORDER.map((g) => ({ g, items: confirmed.filter((x) => x.w === g).map((x) => x.c) })).filter((x) => x.items.length);
  const counts = useMemo(() => {
    const out: Partial<Record<ConfirmationStatus, number>> = {};
    for (const c of cars.data?.items ?? []) if (c.confirmation) out[c.confirmation] = (out[c.confirmation] ?? 0) + 1;
    return out;
  }, [cars.data]);

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Nouveautés</span>
        <h1>Les prochaines voitures</h1>
        <p>Quelles voitures vont sortir, et quand ? Les périodes sont calculées au {formatDate(now.toISOString())} pour le marché {marketInfo(preferences.market).name}. Une sortie annoncée « en 2027 » n’apparaît jamais dans « 3 mois ».</p>
      </header>

      <div className="row gap-3 wrap" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="chip-scroll" style={{ margin: 0, padding: 0, flexBasis: '100%' }} role="group" aria-label="Période">
          {WINDOWS.map((w) => <button key={w.id} type="button" className="chip" aria-pressed={win === w.id} onClick={() => setWin(w.id)}>{w.label}</button>)}
        </div>
        <div className="segmented" role="group" aria-label="Niveau de confirmation">
          <button type="button" aria-pressed={conf === 'all'} onClick={() => setConf('all')}>Tout</button>
          <button type="button" aria-pressed={conf === 'confirmed'} onClick={() => setConf('confirmed')}>Officiel uniquement</button>
        </div>
      </div>

      {!!Object.keys(counts).length && (
        <p className="provenance" style={{ marginBottom: 'var(--space-5)' }}>
          {Object.entries(counts).map(([k, n]) => <span key={k}>{CONFIRMATION_LABELS[k as ConfirmationStatus]} : {n}</span>)}
        </p>
      )}

      {cars.isLoading ? <CardGridSkeleton count={6} /> : cars.isError ? <ErrorState message="Les nouveautés ne sont pas disponibles pour le moment." onRetry={() => cars.refetch()} /> : (
        <>
          {groups.length ? groups.map(({ g, items }) => (
            <section key={g} className="section" style={{ marginTop: 'var(--space-6)' }}>
              <div className="section-head"><div><h2>{GROUP_LABEL[g]}</h2><p>{items.length} modèle{items.length > 1 ? 's' : ''}</p></div></div>
              <div className="card-grid">{items.map((c: CarSummary) => <CarCard key={c.id} car={c} />)}</div>
            </section>
          )) : <EmptyState icon={<CalendarClock size={28} />} title="Aucune sortie confirmée sur cette période" message="Essayez une période plus large ou « Toutes »." />}

          {conf === 'all' && rumors.length > 0 && (
            <section className="section rumor-zone">
              <div className="section-head"><div><h2>Rumeurs et informations de presse</h2><p>Non confirmées par les constructeurs : à lire comme des pistes, pas comme des lancements certains.</p></div></div>
              <Notice tone="warning">Ces modèles sont évoqués par la presse ou par des rumeurs. Leur existence, leurs dates et leurs caractéristiques peuvent changer ou ne jamais se concrétiser.</Notice>
              <div className="card-grid" style={{ marginTop: 'var(--space-4)' }}>{rumors.map(({ c }) => <CarCard key={c.id} car={c} />)}</div>
            </section>
          )}

          {conf === 'all' && cancelled.length > 0 && (
            <section className="section">
              <div className="section-head"><div><h2>Projets annulés ou abandonnés</h2><p>Annulations confirmées par les constructeurs ou leurs dirigeants.</p></div></div>
              <div className="card-grid">{cancelled.map((c) => <CarCard key={c.id} car={c} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
