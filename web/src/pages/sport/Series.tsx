/** WEC et WRC : instantané sourcé et daté (aucune API officielle ouverte pour ces championnats). */
import { useState } from 'react';
import type { WecSeason, WrcSeason } from '@shared/sport';
import { useSeries } from '../../hooks/queries';
import { ErrorState, Notice } from '../../components/States';
import { formatDate, formatDateRange, formatLocalDateTime } from '../../lib/format';
import { EventStatus, SourceLinks, TimezoneNote } from './common';
import { SportNews } from './SportNews';

function SnapshotNotice({ asOf }: { asOf: string }) {
  return (
    <Notice>
      Données compilées le {formatDate(asOf)} à partir des sites officiels du championnat et de la presse spécialisée (sources détaillées sous chaque épreuve).
      Aucun flux officiel ouvert n’existe : ces résultats ne sont pas mis à jour en temps réel.
    </Notice>
  );
}

const statusOf = (s: string) => s as 'upcoming' | 'live' | 'completed' | 'cancelled';

export function WecPage() {
  const q = useSeries('wec');
  const [cls, setCls] = useState('hypercar');
  if (q.isLoading) return <div className="skeleton" style={{ height: 420 }} />;
  if (q.isError || !q.data) return <ErrorState message="Les données du WEC ne sont pas disponibles." onRetry={() => q.refetch()} />;
  const d = q.data.data as WecSeason;
  const st = d.standings as (WecSeason['standings'] & {
    hypercarDrivers?: Array<{ position: number; drivers: string[]; team: string; points: number }>;
    hypercarManufacturers?: Array<{ position: number; manufacturer: string; points: number }>;
    lmgt3Drivers?: Array<{ position: number; drivers: string[]; team: string; points: number }>;
    lmgt3Teams?: Array<{ position: number; team: string; points: number }>;
  }) | null;
  const className = d.classes.find((c) => c.id === cls)?.name ?? cls;
  const drivers = cls === 'hypercar' ? st?.hypercarDrivers : st?.lmgt3Drivers;
  return (
    <div className="stack gap-6">
      <SnapshotNotice asOf={q.data.fetchedAt} />
      <div className="row gap-3 wrap">
        <div className="segmented" role="group" aria-label="Catégorie">
          {d.classes.map((c) => <button key={c.id} type="button" aria-pressed={cls === c.id} onClick={() => setCls(c.id)}>{c.name}</button>)}
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', flex: 1, minWidth: 240 }}>{d.classes.find((c) => c.id === cls)?.description}</p>
      </div>

      {st && (
        <div className="standings-grid">
          <div className="panel">
            <h3>Pilotes — {className}</h3>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Après la manche {st.afterRound} · au {formatDate(st.asOf)}</p>
            {drivers?.length ? (
              <table className="data-table"><thead><tr><th>Pos.</th><th>Équipage</th><th className="r">Pts</th></tr></thead>
                <tbody>{drivers.map((r) => <tr key={r.position + r.team}><td className="num">{r.position}</td><td>{r.drivers.join(', ')}<div className="subtle" style={{ fontSize: 12 }}>{r.team}</div></td><td className="r num"><strong>{r.points}</strong></td></tr>)}</tbody>
              </table>
            ) : <p className="muted">Classement non disponible.</p>}
          </div>
          <div className="panel">
            <h3>{cls === 'hypercar' ? 'Constructeurs — Hypercar' : 'Équipes — LMGT3'}</h3>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Après la manche {st.afterRound} · au {formatDate(st.asOf)}</p>
            <table className="data-table"><thead><tr><th>Pos.</th><th>{cls === 'hypercar' ? 'Constructeur' : 'Équipe'}</th><th className="r">Pts</th></tr></thead>
              <tbody>{(cls === 'hypercar' ? st.hypercarManufacturers?.map((r) => ({ p: r.position, n: r.manufacturer, pts: r.points })) : st.lmgt3Teams?.map((r) => ({ p: r.position, n: r.team, pts: r.points })))?.map((r) => (
                <tr key={r.p + r.n}><td className="num">{r.p}</td><td>{r.n}</td><td className="r num"><strong>{r.pts}</strong></td></tr>
              ))}</tbody>
            </table>
            <SourceLinks sources={st.sources} />
          </div>
        </div>
      )}

      <section className="stack gap-4">
        <div className="section-head" style={{ margin: 0 }}><div><h2>Calendrier et podiums {d.season}</h2><p>Résultats affichés par catégorie, jamais mélangés.</p></div></div>
        <TimezoneNote />
        <div className="event-list">
          {d.events.map((e) => {
            const res = e.results?.find((r) => r.classId === cls);
            return (
              <article key={`${e.round}-${e.shortName}`} className="panel event-row" data-status={e.status}>
                <div className="event-row-head">
                  <span className="num subtle">{e.round ? `M${e.round}` : '—'}</span>
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <strong>{e.name}</strong>
                    <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{e.circuit} · {e.country}{e.durationLabel ? ` · ${e.durationLabel}` : ''}</span>
                  </div>
                  <EventStatus status={statusOf(e.status)} />
                </div>
                <p className="num" style={{ fontSize: 'var(--text-sm)' }}>
                  {e.startDate && e.endDate ? formatDateRange(e.startDate, e.endDate) : 'Dates non publiées'}
                  {e.raceStartUtc && e.status !== 'cancelled' && <span className="muted"> · départ {formatLocalDateTime(e.raceStartUtc)}</span>}
                </p>
                {res ? (
                  <ol className="mini-podium">
                    {res.podium.map((p) => (
                      <li key={p.position}><span className="num pos">{p.position}</span><span><strong>{p.carNumber ? `#${p.carNumber} ` : ''}{p.team}</strong>{p.car && <span className="subtle"> · {p.car}</span>}<br /><span className="muted" style={{ fontSize: 12 }}>{p.drivers.join(', ')}</span></span></li>
                    ))}
                  </ol>
                ) : e.status === 'completed' ? <p className="subtle" style={{ fontSize: 'var(--text-sm)' }}>Podium {className} non intégré — consultez la source officielle.</p> : null}
                <SourceLinks sources={e.sources} />
              </article>
            );
          })}
        </div>
      </section>

      {!!d.manufacturers.length && (
        <section className="panel">
          <h3>Constructeurs engagés</h3>
          <ul className="team-list">{d.manufacturers.filter((m) => m.class === cls).map((m) => <li key={m.name + m.car}><strong>{m.name}</strong><span className="muted">{m.car}</span>{m.note && <span className="subtle" style={{ fontSize: 12 }}>{m.note}</span>}</li>)}</ul>
        </section>
      )}
      <SportNews scope="wec" />
      <SourceLinks sources={d.sources} />
    </div>
  );
}

export function WrcPage() {
  const q = useSeries('wrc');
  if (q.isLoading) return <div className="skeleton" style={{ height: 420 }} />;
  if (q.isError || !q.data) return <ErrorState message="Les données du WRC ne sont pas disponibles." onRetry={() => q.refetch()} />;
  const d = q.data.data as WrcSeason;
  const st = d.standings;
  return (
    <div className="stack gap-6">
      <SnapshotNotice asOf={q.data.fetchedAt} />
      {st && (
        <div className="standings-grid">
          <div className="panel">
            <h3>Pilotes — WRC (Rally1)</h3>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Après la manche {st.afterRound} · au {formatDate(st.asOf)}</p>
            <table className="data-table"><thead><tr><th>Pos.</th><th>Pilote / copilote</th><th className="r">Pts</th></tr></thead>
              <tbody>{st.drivers.map((r) => <tr key={r.position + r.driver}><td className="num">{r.position}</td><td>{r.driver}{r.coDriver && <span className="muted"> / {r.coDriver}</span>}{r.team && <div className="subtle" style={{ fontSize: 12 }}>{r.team}</div>}</td><td className="r num"><strong>{r.points}</strong></td></tr>)}</tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Constructeurs</h3>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Après la manche {st.afterRound} · au {formatDate(st.asOf)}</p>
            <table className="data-table"><thead><tr><th>Pos.</th><th>Équipe</th><th className="r">Pts</th></tr></thead>
              <tbody>{st.manufacturers.map((r) => <tr key={r.position + r.team}><td className="num">{r.position}</td><td>{r.team}</td><td className="r num"><strong>{r.points}</strong></td></tr>)}</tbody>
            </table>
            <SourceLinks sources={st.sources} />
          </div>
        </div>
      )}
      <section className="stack gap-4">
        <div className="section-head" style={{ margin: 0 }}><div><h2>Rallyes {d.season}</h2><p>Podiums de la catégorie reine (Rally1). Temps : total du vainqueur, écart pour les suivants.</p></div></div>
        <div className="event-list">
          {d.events.map((e) => (
            <article key={`${e.round}-${e.shortName}`} className="panel event-row" data-status={e.status}>
              <div className="event-row-head">
                <span className="num subtle">{e.round ? `M${e.round}` : '—'}</span>
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <strong>{e.name}</strong>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{[e.country, e.base, e.surface].filter(Boolean).join(' · ')}{e.stages ? ` · ${e.stages} spéciales` : ''}{e.distanceKm ? ` · ${e.distanceKm} km chronométrés` : ''}</span>
                </div>
                <EventStatus status={statusOf(e.status)} />
              </div>
              <p className="num" style={{ fontSize: 'var(--text-sm)' }}>{e.startDate && e.endDate ? formatDateRange(e.startDate, e.endDate) : 'Dates non publiées'}</p>
              {e.results ? (
                <ol className="mini-podium">
                  {e.results.podium.map((p) => <li key={p.position}><span className="num pos">{p.position}</span><span><strong>{p.driver}</strong>{p.coDriver && <span className="muted"> / {p.coDriver}</span>}<br /><span className="subtle" style={{ fontSize: 12 }}>{[p.car, p.time].filter(Boolean).join(' · ')}</span></span></li>)}
                </ol>
              ) : e.status === 'completed' ? <p className="subtle" style={{ fontSize: 'var(--text-sm)' }}>Podium non intégré — consultez la source officielle.</p> : null}
              <SourceLinks sources={e.sources} />
            </article>
          ))}
        </div>
      </section>
      {!!d.teams.length && (
        <section className="panel">
          <h3>Équipes engagées</h3>
          <ul className="team-list">{d.teams.map((t) => <li key={t.name}><strong>{t.name}</strong><span className="muted">{t.car}</span><span className="subtle" style={{ fontSize: 12 }}>{t.drivers.join(', ')}</span></li>)}</ul>
        </section>
      )}
      <SportNews scope="wrc" />
      <SourceLinks sources={d.sources} />
    </div>
  );
}
