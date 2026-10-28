import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleCheck, CircleHelp, Equal, Minus, Plus } from 'lucide-react';
import type { CarDetail, PriceView } from '@shared/api';
import type { Generation, LaunchMilestones, MarketCode, Source, Variant } from '@shared/types';
import { CATEGORY_LABELS, MILESTONE_LABELS, PRICE_TYPE_LABELS, isUnconfirmed } from '@shared/labels';
import { formatPartialDate } from '@shared/dates';
import { useCar } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { CarImage, ImageCredit } from '../components/CarImage';
import { CompareButton, HeartButton, ShareButton } from '../components/CarActions';
import { ConfirmationBadge, StatusBadge } from '../components/Badges';
import { PriceDetail } from '../components/PriceTag';
import { CarCard } from '../components/CarCard';
import { EmptyState, ErrorState, Notice } from '../components/States';
import { SPECS, SPEC_GROUPS, formatDelta, specByKey } from '../lib/specs';
import { formatDate, formatMoney, marketInfo } from '../lib/format';
import { ApiError } from '../lib/api';

const TIER_LABEL: Record<Variant['tier'], string> = { entry: 'Entrée de gamme', mid: 'Intermédiaire', sport: 'Sportive', top: 'Haut de gamme' };

function Gallery({ d }: { d: CarDetail }) {
  const [i, setI] = useState(0);
  const img = d.images[i] ?? null;
  const name = `${d.brand.name} ${d.generation.modelName}`;
  return (
    <div className="gallery">
      <div className="gallery-main car-media" style={{ '--brand-accent': d.brand.accent } as CSSProperties}>
        <CarImage image={img} alt={`${name} ${d.generation.name}${img ? ` — ${img.depicts}` : ''}`} eager large />
      </div>
      {d.images.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Photos">
          {d.images.map((im, k) => (
            <button key={im.src} type="button" aria-pressed={k === i} aria-label={`Photo ${k + 1} : ${im.depicts}`} onClick={() => setI(k)}>
              <img src={im.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
      {img && <ImageCredit image={img} />}
    </div>
  );
}

function SpecSheet({ variant, market }: { variant: Variant; market: MarketCode }) {
  const missing: string[] = [];
  return (
    <div className="spec-groups">
      {SPEC_GROUPS.filter((g) => g !== 'Prix').map((group) => {
        const rows = SPECS.filter((s) => s.group === group).map((s) => ({ s, v: s.display(variant, market) }));
        rows.filter((r) => r.v == null).forEach((r) => missing.push(r.s.label));
        const shown = rows.filter((r) => r.v != null);
        if (!shown.length) return null;
        return (
          <div key={group} className="spec-group">
            <h4 className="eyebrow">{group}</h4>
            <dl>{shown.map(({ s, v }) => <div key={s.key} className="spec-row"><dt>{s.label}</dt><dd className="num">{v}</dd></div>)}</dl>
          </div>
        );
      })}
      {!!missing.length && (
        <p className="subtle spec-missing">Non communiqué par les sources consultées : {missing.join(', ').toLowerCase()}.</p>
      )}
      {variant.notes && <Notice>{variant.notes}</Notice>}
    </div>
  );
}

function SourceList({ sources, title = 'Sources' }: { sources: Source[]; title?: string }) {
  const unique = [...new Map(sources.map((s) => [s.url, s])).values()];
  if (!unique.length) return null;
  return (
    <details className="panel sources-panel">
      <summary><strong>{title}</strong> <span className="subtle">({unique.length})</span></summary>
      <ul className="sources" style={{ marginTop: 'var(--space-3)' }}>
        {unique.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
            <span className="subtle"> · {s.type === 'manufacturer' ? 'constructeur' : s.type === 'press' ? 'presse' : s.type === 'community' ? 'communautaire' : 'base de données'}
              {s.publishedAt ? ` · publié le ${formatDate(s.publishedAt)}` : ''} · consulté le {formatDate(s.retrievedAt)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Milestones({ launch }: { launch: LaunchMilestones }) {
  const keys = Object.keys(MILESTONE_LABELS) as Array<keyof LaunchMilestones>;
  return (
    <ol className="milestones">
      {keys.map((k) => {
        const m = launch[k];
        return (
          <li key={k} className={m?.date ? 'known' : 'unknown'}>
            <span className="ms-dot" aria-hidden="true" />
            <span className="ms-label">{MILESTONE_LABELS[k]}</span>
            <span className="ms-date num">{m?.date ? formatPartialDate(m.date) : 'Non communiqué'}{m?.market && m.date ? <span className="subtle"> · {m.market === 'EU' ? 'Europe' : m.market === 'WORLD' ? 'monde' : marketInfo(m.market as MarketCode).name}</span> : null}</span>
            {m?.source && <a className="subtle ms-src" href={m.source.url} target="_blank" rel="noreferrer">{m.source.label}</a>}
          </li>
        );
      })}
    </ol>
  );
}

function Editorial({ g }: { g: Generation }) {
  const e = g.editorial;
  const blocks: Array<[string, string[]]> = [
    ['Points forts', e.pros],
    ['Ce qui la distingue', e.differentiators],
    ['Technologies et innovations', e.innovations],
    ['Compromis à connaître', e.compromises],
  ];
  const hasOpinion = blocks.some(([, l]) => l.length) || e.pricePositioning;
  return (
    <div className="takeaways">
      {!!e.technicalFacts.length && (
        <div className="panel">
          <span className="badge plain info">Faits techniques</span>
          <ul className="bullet-list">{e.technicalFacts.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      {hasOpinion && (
        <div className="panel">
          <span className="badge plain accent">Analyse éditoriale</span>
          <p className="subtle" style={{ fontSize: 'var(--text-xs)', margin: 'var(--space-2) 0 var(--space-3)' }}>Appréciations de la rédaction, distinctes des données vérifiables.</p>
          <div className="editorial-cols">
            {blocks.filter(([, l]) => l.length).map(([title, l]) => (
              <div key={title}>
                <h4>{title}</h4>
                <ul className="bullet-list">{l.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
            {e.pricePositioning && <div><h4>Positionnement tarifaire</h4><p className="muted">{e.pricePositioning}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}

function VariantsTable({ g, market, selected, onSelect }: { g: Generation; market: MarketCode; selected: string; onSelect: (id: string) => void }) {
  const rows = ['power', 'torque', 'accel', 'range', 'consumption', 'price'].map(specByKey)
    .filter((s) => g.variants.some((v) => s.display(v, market) != null));
  return (
    <div className="table-scroll">
      <table className="data-table variants-table">
        <thead>
          <tr><th>Version</th>{rows.map((s) => <th key={s.key}>{s.label}</th>)}</tr>
        </thead>
        <tbody>
          {g.variants.map((v) => (
            <tr key={v.id} aria-selected={v.id === selected} onClick={() => onSelect(v.id)}>
              <td>
                <button type="button" className="link-btn" onClick={() => onSelect(v.id)}><strong>{v.name}</strong></button>
                <div className="subtle" style={{ fontSize: 12 }}>{TIER_LABEL[v.tier]}</div>
                {!!v.equipmentHighlights.length && <div className="muted" style={{ fontSize: 12, maxWidth: 280 }}>{v.equipmentHighlights.slice(0, 3).join(' · ')}</div>}
              </td>
              {rows.map((s) => <td key={s.key} className="num">{s.display(v, market) ?? <span className="subtle">—</span>}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricesBlock({ g, summary, market }: { g: Generation; summary: CarDetail['summary']; market: MarketCode }) {
  const all = g.variants.flatMap((v) => v.prices.map((p) => ({ ...p, variantName: v.name }) as PriceView & { variantName: string }));
  const local = all.filter((p) => p.market === market);
  const elsewhere = [...new Set(all.filter((p) => p.market !== market).map((p) => p.market))];
  const last = all.map((p) => p.asOf).sort().at(-1);
  return (
    <div className="prices-grid">
      <div className="panel stack gap-4">
        {summary.startingPrice ? <PriceDetail price={summary.startingPrice} market={market} /> : (
          <div className="stack gap-1">
            <span className="eyebrow">{marketInfo(market).name}</span>
            <strong className="display" style={{ fontSize: 'var(--text-xl)' }}>{g.upcoming ? 'Prix non annoncé' : 'Prix non communiqué'}</strong>
            <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Aucun tarif {g.upcoming ? 'officiel' : 'vérifié'} pour ce marché dans les sources consultées.</span>
          </div>
        )}
        {summary.estimatedPrice && !summary.startingPrice && (
          <div className="notice warning"><CircleHelp size={16} /><div><strong>Estimation, non officielle.</strong><PriceDetail price={summary.estimatedPrice} market={market} /></div></div>
        )}
        {last && <span className="provenance">Dernier tarif relevé : {formatDate(last)}</span>}
      </div>
      {local.length > 1 && (
        <div className="panel">
          <h3>Prix par version · {marketInfo(market).name}</h3>
          <table className="data-table">
            <tbody>{local.sort((a, b) => a.amount - b.amount).map((p) => (
              <tr key={p.variantName + p.type}><td>{p.variantName}</td><td className="subtle">{PRICE_TYPE_LABELS[p.type]}</td><td className="r num"><strong>{formatMoney(p.amount, p.currency, market)}</strong></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {!!elsewhere.length && (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Tarifs disponibles pour : {elsewhere.map((m) => marketInfo(m).name).join(', ')}. Changez de marché dans votre profil pour les afficher.
        </p>
      )}
    </div>
  );
}

function WhatChanges({ d, market }: { d: CarDetail; market: MarketCode }) {
  const c = d.generation.changes!;
  const prev = d.previous!;
  const cur = c.comparablePair ? d.generation.variants.find((v) => v.id === c.comparablePair!.currentVariantId) : null;
  const old = c.comparablePair ? prev.variants.find((v) => v.id === c.comparablePair!.previousVariantId) : null;
  const numeric = cur && old ? SPECS.filter((s) => s.value && s.key !== 'price')
    .map((s) => ({ s, a: s.value!(cur, market), b: s.value!(old, market) }))
    .filter((r) => r.a != null && r.b != null) : [];
  const lists: Array<[string, string[], 'new' | 'same' | 'tradeoff']> = [
    ['Design', c.design, 'new'], ['Technologies embarquées', c.technology, 'new'], ['Équipements', c.equipment, 'new'],
    ['Châssis et transmission', c.chassis, 'new'], ['Ce qui ne change pas', c.unchanged, 'same'], ['Compromis', c.tradeoffs, 'tradeoff'],
  ];
  return (
    <div className="stack gap-5">
      <p className="muted">
        Par rapport à la génération précédente : <Link to={`/voiture/${prev.id}`} className="inline-link">{d.brand.name} {prev.modelName} {prev.name}</Link> ({prev.yearsLabel}).
      </p>
      {cur && old ? (
        <div className="panel">
          <h3>Version comparable : {cur.name} contre {old.name}</h3>
          <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-4)' }}>Seules des versions équivalentes sont mises en regard. Un écart n’indique pas qu’une génération est « meilleure ».</p>
          <ul className="delta-list">
            {numeric.map(({ s, a, b }) => {
              const diff = a! - b!;
              const tone = diff === 0 || !s.higherIs ? 'neutral' : (diff > 0) === (s.higherIs === 'more') ? 'up' : 'down';
              return (
                <li key={s.key} className={`delta ${tone}`}>
                  <span className="delta-label">{s.label}</span>
                  <span className="delta-values num"><strong>{s.display(cur, market)}</strong> <span className="subtle">contre {s.display(old, market)}</span></span>
                  <span className="delta-chip num">{diff === 0 ? 'identique' : formatDelta(a!, b!, s.unit)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : <Notice>Aucune paire de versions strictement comparables n’a été identifiée : la comparaison reste qualitative.</Notice>}
      <div className="change-cols">
        {lists.filter(([, l]) => l.length).map(([title, l, kind]) => (
          <div key={title} className="panel">
            <h4 className="row gap-2">{kind === 'same' ? <Equal size={16} /> : kind === 'tradeoff' ? <Minus size={16} /> : <Plus size={16} />}{title}</h4>
            <ul className="bullet-list">{l.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CarDetailPage() {
  const { id } = useParams();
  const q = useCar(id);
  const navigate = useNavigate();
  const { preferences } = useProfile();
  const market = preferences.market;
  const [variantId, setVariantId] = useState<string | null>(null);
  const d = q.data;
  useEffect(() => { setVariantId(null); }, [id]);
  const variant = useMemo(() => d?.generation.variants.find((v) => v.id === variantId) ?? d?.generation.variants[0] ?? null, [d, variantId]);

  if (q.isLoading) return <div className="detail-skeleton"><div className="skeleton" style={{ aspectRatio: '16/9' }} /><div className="skeleton" style={{ height: 40, width: '50%', marginTop: 24 }} /></div>;
  if (q.isError || !d) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return notFound
      ? <EmptyState title="Fiche introuvable" message="Ce modèle n’existe pas ou a été retiré du catalogue. S’il était dans votre wishlist, il y reste consultable." action={<Link to="/explorer" className="btn btn-sm">Retour au catalogue</Link>} />
      : <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />;
  }
  const g = d.generation;
  const s = d.summary;
  const sources = [...g.sources, ...g.variants.flatMap((v) => v.sources), ...(g.changes?.sources ?? [])];

  return (
    <article className="detail page-enter" style={{ '--brand-accent': d.brand.accent } as CSSProperties}>
      <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/explorer'))} className="section-link" style={{ marginBottom: 'var(--space-2)' }}>
        <ArrowLeft size={16} /> Retour
      </button>

      <header className="detail-hero">
        <Gallery d={d} />
        <div className="detail-intro">
          <div className="car-brand"><i aria-hidden="true" /><span className="eyebrow">{d.brand.name}</span></div>
          <h1 className="display detail-title">{g.modelName}</h1>
          <p className="detail-sub">{g.name} · {g.yearsLabel}</p>
          <div className="row gap-2 wrap">
            {g.upcoming ? <ConfirmationBadge status={g.upcoming.confirmation} /> : <StatusBadge status={g.status} />}
            {g.segment && <span className="badge plain neutral">{g.segment}</span>}
            {g.bodyStyles.map((b) => <span key={b} className="badge plain neutral">{b}</span>)}
          </div>
          {g.upcoming && isUnconfirmed(g.upcoming.confirmation) && (
            <Notice tone="warning">Information non confirmée par le constructeur : ce modèle n’est pas un lancement certain.</Notice>
          )}
          <p className="detail-summary">{g.editorial.summary}</p>
          {g.editorial.positioning && <p className="muted"><strong style={{ color: 'var(--text)' }}>Dans la gamme : </strong>{g.editorial.positioning}</p>}
          <div className="row gap-1 wrap">
            {g.categories.map((c) => <Link key={c} to={`/explorer?categories=${c}`} className="chip" style={{ minHeight: 30, fontSize: 12 }}>{CATEGORY_LABELS[c]}</Link>)}
          </div>
          <div className="detail-actions">
            <HeartButton car={s} size={22} />
            <CompareButton car={s} size={22} />
            <ShareButton car={s} size={22} />
            <span className="subtle" style={{ fontSize: 'var(--text-xs)', marginLeft: 'auto' }}>Fiche mise à jour le {formatDate(g.updatedAt)}</span>
          </div>
        </div>
      </header>

      <nav className="detail-nav" aria-label="Sections de la fiche">
        {g.upcoming && <a href="#annonce">Annonce</a>}
        {variant && <a href="#technique">Fiche technique</a>}
        <a href="#retenir">À retenir</a>
        {g.variants.length > 1 && <a href="#versions">Versions</a>}
        <a href="#prix">Prix</a>
        {g.changes && d.previous && <a href="#evolution">Qu’est-ce qui change ?</a>}
        {!!d.similar.length && <a href="#similaires">Similaires</a>}
      </nav>

      {g.upcoming && (
        <section id="annonce" className="section">
          <div className="section-head"><div><h2>Ce qui a été annoncé</h2><p>Confirmé, inconnu et calendrier de lancement — chaque étape est distincte.</p></div></div>
          <div className="announce-grid">
            <div className="panel">
              <h3 className="row gap-2"><CircleCheck size={18} color="var(--positive)" /> Confirmé</h3>
              {g.upcoming.confirmed.length ? <ul className="bullet-list">{g.upcoming.confirmed.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">Aucune caractéristique officiellement confirmée.</p>}
            </div>
            <div className="panel">
              <h3 className="row gap-2"><CircleHelp size={18} color="var(--warning)" /> Encore inconnu</h3>
              {g.upcoming.unknown.length ? <ul className="bullet-list">{g.upcoming.unknown.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">—</p>}
            </div>
            {g.launch && <div className="panel"><h3>Calendrier de lancement</h3><Milestones launch={g.launch} /></div>}
          </div>
        </section>
      )}

      {variant && (
        <section id="technique" className="section">
          <div className="section-head"><div><h2>Fiche technique</h2><p>Données de la version sélectionnée uniquement — jamais de mélange entre versions.</p></div></div>
          {g.variants.length > 1 && (
            <div className="chip-scroll" style={{ marginBottom: 'var(--space-4)' }} role="group" aria-label="Version">
              {g.variants.map((v) => <button key={v.id} type="button" className="chip" aria-pressed={v.id === variant.id} onClick={() => setVariantId(v.id)}>{v.name}</button>)}
            </div>
          )}
          <SpecSheet variant={variant} market={market} />
        </section>
      )}

      <section id="retenir" className="section">
        <div className="section-head"><div><h2>Ce qu’il faut retenir</h2></div></div>
        <Editorial g={g} />
      </section>

      {g.variants.length > 1 && (
        <section id="versions" className="section">
          <div className="section-head"><div><h2>Les différentes versions</h2><p>{g.variants.length} versions documentées. Touchez une ligne pour afficher sa fiche technique.</p></div></div>
          <VariantsTable g={g} market={market} selected={variant?.id ?? ''} onSelect={(vid) => { setVariantId(vid); document.getElementById('technique')?.scrollIntoView({ behavior: 'smooth' }); }} />
        </section>
      )}

      <section id="prix" className="section">
        <div className="section-head"><div><h2>Prix et disponibilité</h2><p>Marché : {marketInfo(market).name}. Prix TTC, avec la version et la date du relevé.</p></div></div>
        <PricesBlock g={g} summary={s} market={market} />
        {g.launch && !g.upcoming && <div className="panel" style={{ marginTop: 'var(--space-4)' }}><h3>Dates clés</h3><Milestones launch={g.launch} /></div>}
      </section>

      {g.changes && d.previous && (
        <section id="evolution" className="section">
          <div className="section-head"><div><h2>Qu’est-ce qui change&nbsp;?</h2></div></div>
          <WhatChanges d={d} market={market} />
        </section>
      )}

      {(d.otherGenerations.length > 0) && (
        <section className="section">
          <div className="section-head"><div><h2>Autres générations</h2></div></div>
          <div className="rail">{d.otherGenerations.map((o) => <CarCard key={o.id} car={o} />)}</div>
        </section>
      )}

      {!!d.similar.length && (
        <section id="similaires" className="section">
          <div className="section-head"><div><h2>Modèles similaires</h2><p>Proches par catégorie, prix, puissance, gabarit ou motorisation — avec la raison de chaque suggestion.</p></div></div>
          <div className="rail">{d.similar.map((x) => <CarCard key={x.car.id} car={x.car} reason={x.reasons.slice(0, 2).join(' · ')} />)}</div>
        </section>
      )}

      <section className="section"><SourceList sources={sources} /></section>
      {d.next && (
        <Link to={`/voiture/${d.next.id}`} className="panel row between" style={{ marginTop: 'var(--space-5)' }}>
          <span><span className="eyebrow">Génération suivante</span><br /><strong>{d.next.brandName} {d.next.modelName} {d.next.generationName}</strong></span>
          <ArrowRight size={20} />
        </Link>
      )}
    </article>
  );
}
