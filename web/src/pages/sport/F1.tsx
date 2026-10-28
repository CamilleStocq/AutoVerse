import { useState } from 'react';
import type { F1Race, F1ResultRow } from '@shared/sport';
import { useF1, useF1Round } from '../../hooks/queries';
import { ErrorState, Freshness, Notice } from '../../components/States';
import { formatDate, formatLocalDateTime } from '../../lib/format';
import { TimezoneNote } from './common';
import { SportNews } from './SportNews';

const TEAM_COLORS: Record<string, string> = {
  mercedes: '#27f4d2', ferrari: '#e8002d', red_bull: '#3671c6', mclaren: '#ff8000', aston_martin: '#229971',
  alpine: '#ff87bc', williams: '#64c4ff', rb: '#6692ff', sauber: '#52e252', haas: '#b6babd', audi: '#bb0a30', cadillac: '#c9b47c',
};

function RaceStatus({ race }: { race: F1Race }) {
  if (race.status === 'completed') return <span className="badge neutral">Terminé</span>;
  if (race.status === 'live') return <span className="badge accent">En cours — résultats après l’arrivée</span>;
  return <span className="badge info">À venir</span>;
}

function RoundPanel({ season, race }: { season: number; race: F1Race }) {
  const q = useF1Round(season, race.round);
  const [tab, setTab] = useState<'race' | 'quali' | 'sprint'>(race.status === 'completed' ? 'race' : 'quali');
  const d = q.data?.data;
  return (
    <div className="panel stack gap-4">
      <div className="row between wrap gap-2">
        <div>
          <span className="eyebrow">Manche {race.round} · {race.locality}, {race.country}</span>
          <h3 style={{ margin: 'var(--space-1) 0 0' }}>{race.name}</h3>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>{race.circuit}</p>
        </div>
        <RaceStatus race={race} />
      </div>
      {!!race.sessions.length && (
        <ul className="session-list">
          {race.sessions.map((s) => <li key={s.name + s.startUtc}><span>{s.name}</span><span className="num muted">{formatLocalDateTime(s.startUtc)}</span></li>)}
        </ul>
      )}
      <TimezoneNote />
      <div className="segmented" role="group" aria-label="Séance">
        <button type="button" aria-pressed={tab === 'race'} onClick={() => setTab('race')}>Course</button>
        <button type="button" aria-pressed={tab === 'quali'} onClick={() => setTab('quali')}>Qualifications</button>
        {race.hasSprint && <button type="button" aria-pressed={tab === 'sprint'} onClick={() => setTab('sprint')}>Sprint</button>}
      </div>
      {q.isLoading && <div className="skeleton" style={{ height: 200 }} />}
      {q.isError && <ErrorState message="Résultats momentanément indisponibles." onRetry={() => q.refetch()} />}
      {d && tab === 'race' && (d.results ? <ResultsTable rows={d.results} /> : <Notice>Course non encore disputée : aucun résultat n’est affiché avant la publication du classement officiel.</Notice>)}
      {d && tab === 'sprint' && (d.sprint ? <ResultsTable rows={d.sprint} /> : <Notice>Résultats du sprint non encore publiés.</Notice>)}
      {d && tab === 'quali' && (d.qualifying ? (
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Pos.</th><th>Pilote</th><th>Écurie</th><th className="r">Q1</th><th className="r">Q2</th><th className="r">Q3</th></tr></thead>
          <tbody>{d.qualifying.map((r) => (
            <tr key={r.driver.id}><td className="num">{r.position}</td><td>{r.driver.name}</td><td className="muted">{r.team.name}</td><td className="r">{r.q1 ?? '—'}</td><td className="r">{r.q2 ?? '—'}</td><td className="r">{r.q3 ?? '—'}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <Notice>Qualifications non encore disputées ou résultats non publiés.</Notice>)}
    </div>
  );
}

function ResultsTable({ rows }: { rows: F1ResultRow[] }) {
  return (
    <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Pos.</th><th>Pilote</th><th>Écurie</th><th className="r">Grille</th><th className="r">Temps / statut</th><th className="r">Pts</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.driver.id}>
          <td className="num">{r.position ?? r.positionText}</td>
          <td><span className="team-dot" style={{ background: TEAM_COLORS[r.team.id] ?? 'var(--text-subtle)' }} />{r.driver.name}{r.fastestLap && <span className="badge plain accent" style={{ marginLeft: 6, height: 18 }}>Meilleur tour</span>}</td>
          <td className="muted">{r.team.name}</td>
          <td className="r num">{r.grid || 'Stands'}</td>
          <td className="r num">{r.time ?? r.status}</td>
          <td className="r num">{r.points}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

export function F1Page() {
  const f1 = useF1();
  const [round, setRound] = useState<number | null>(null);
  if (f1.isLoading) return <div className="skeleton" style={{ height: 420 }} />;
  if (f1.isError || !f1.data) return <ErrorState message="Les données de Formule 1 sont momentanément indisponibles." onRetry={() => f1.refetch()} />;
  const d = f1.data.data;
  const selected = d.schedule.find((r) => r.round === (round ?? d.lastRace?.race.round ?? d.nextRace?.round));
  const podium = d.lastRace?.results.slice(0, 3) ?? [];
  return (
    <div className="stack gap-6">
      <Freshness fetchedAt={f1.data.fetchedAt} stale={f1.data.stale} errors={f1.data.errors} label="Résultats officiels récupérés" />
      <div className="sport-grid">
        {d.lastRace && (
          <div className="panel podium-hero">
            <span className="eyebrow">Dernier Grand Prix · {formatDate(d.lastRace.race.dateUtc)}</span>
            <h3>{d.lastRace.race.name}</h3>
            <ol className="podium-blocks">
              {[podium[1], podium[0], podium[2]].filter(Boolean).map((r) => (
                <li key={r!.driver.id} className={`p${r!.position}`}>
                  <span className="podium-name">{r!.driver.name}</span>
                  <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>{r!.team.name}</span>
                  <span className="podium-step num" style={{ borderTopColor: TEAM_COLORS[r!.team.id] ?? 'var(--border-strong)' }}>{r!.position}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {d.nextRace && (
          <div className="panel stack gap-3">
            <span className="eyebrow">Prochaine course</span>
            <h3>{d.nextRace.name}</h3>
            <p className="muted">{d.nextRace.circuit} · {d.nextRace.locality}, {d.nextRace.country}</p>
            <strong className="num">{d.nextRace.hasTime ? formatLocalDateTime(d.nextRace.dateUtc) : formatDate(d.nextRace.dateUtc)}</strong>
            <TimezoneNote />
            <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRound(d.nextRace!.round)}>Voir le programme du week-end</button>
          </div>
        )}
      </div>

      <div className="standings-grid">
        {d.drivers && (
          <div className="panel">
            <h3>Classement des pilotes</h3>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Saison {d.season}, après la manche {d.drivers.afterRound}</p>
            <div className="table-scroll"><table className="data-table">
              <thead><tr><th>Pos.</th><th>Pilote</th><th>Écurie</th><th className="r">Vict.</th><th className="r">Pts</th></tr></thead>
              <tbody>{d.drivers.list.map((s) => (
                <tr key={s.driver.id}><td className="num">{s.position}</td><td><span className="team-dot" style={{ background: TEAM_COLORS[s.teams.at(-1)?.id ?? ''] ?? 'var(--text-subtle)' }} />{s.driver.name}</td><td className="muted">{s.teams.map((t) => t.name).join(' / ')}</td><td className="r num">{s.wins}</td><td className="r num"><strong>{s.points}</strong></td></tr>
              ))}</tbody>
            </table></div>
          </div>
        )}
        {d.constructors && (
          <div className="panel">
            <h3>Classement des constructeurs</h3>
            <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Saison {d.season}, après la manche {d.constructors.afterRound}</p>
            <table className="data-table">
              <thead><tr><th>Pos.</th><th>Écurie</th><th className="r">Vict.</th><th className="r">Pts</th></tr></thead>
              <tbody>{d.constructors.list.map((s) => (
                <tr key={s.team.id}><td className="num">{s.position}</td><td><span className="team-dot" style={{ background: TEAM_COLORS[s.team.id] ?? 'var(--text-subtle)' }} />{s.team.name}</td><td className="r num">{s.wins}</td><td className="r num"><strong>{s.points}</strong></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <section className="stack gap-4">
        <div className="section-head" style={{ margin: 0 }}><div><h2>Calendrier et résultats {d.season}</h2><p>Sélectionnez une manche pour ses horaires, qualifications, sprint et résultats.</p></div></div>
        <div className="round-strip" role="list">
          {d.schedule.map((r) => (
            <button key={r.round} type="button" role="listitem" className="round-pill" aria-pressed={selected?.round === r.round} data-status={r.status} onClick={() => setRound(r.round)}>
              <span className="num">M{r.round}</span>
              <span>{r.country}</span>
              <span className="subtle num">{formatDate(r.dateUtc, { day: 'numeric', month: 'short' })}</span>
            </button>
          ))}
        </div>
        {selected && <RoundPanel season={d.season} race={selected} key={selected.round} />}
      </section>

      <SportNews scope="f1" />
      <p className="provenance">Résultats et classements : API Jolpica-F1 (successeur d’Ergast), publiés après chaque séance. Aucun chronométrage en direct n’est disponible gratuitement : l’application n’affiche pas de « live ».</p>
    </div>
  );
}
