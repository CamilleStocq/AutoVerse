import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { GitCompareArrows, Plus, Search, X } from 'lucide-react';
import type { CarDetail } from '@shared/api';
import type { Variant } from '@shared/types';
import { api } from '../lib/api';
import { useCars } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { COMPARE_MAX, useUi } from '../state/UiProvider';
import { CarImage } from '../components/CarImage';
import { EmptyState, ErrorState, Notice } from '../components/States';
import { SPECS, SPEC_GROUPS } from '../lib/specs';
import { marketInfo } from '../lib/format';
import { formatPartialDate } from '@shared/dates';
import { MILESTONE_LABELS } from '@shared/labels';

const TIER_ORDER: Variant['tier'][] = ['entry', 'mid', 'sport', 'top'];

function AddCar({ exclude, onAdd }: { exclude: string[]; onAdd: (id: string) => void }) {
  const [q, setQ] = useState('');
  const res = useCars({ q, pageSize: 6, personalize: false }, q.trim().length > 1);
  return (
    <div className="compare-add panel">
      <label className="search">
        <span className="sr-only">Ajouter une voiture</span>
        <Search size={18} />
        <input className="input" type="search" placeholder="Ajouter une voiture…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {q.trim().length > 1 && (
        <ul className="compare-results">
          {res.data?.items.filter((c) => !exclude.includes(c.id)).map((c) => (
            <li key={c.id}><button type="button" onClick={() => { onAdd(c.id); setQ(''); }}><Plus size={14} /> {c.brandName} {c.modelName} <span className="subtle">{c.generationName}</span></button></li>
          ))}
          {res.data && !res.data.items.length && <li className="subtle" style={{ padding: 8 }}>Aucun résultat</li>}
        </ul>
      )}
    </div>
  );
}

export function Compare() {
  const [sp, setSp] = useSearchParams();
  const { preferences } = useProfile();
  const { compare, setCompare } = useUi();
  const market = preferences.market;
  const ids = (sp.get('ids') ?? compare.map((c) => c.id).join(',')).split(',').filter(Boolean).slice(0, COMPARE_MAX);
  const [variantSel, setVariantSel] = useState<Record<string, string>>({});

  const details = useQueries({
    queries: ids.map((id) => ({ queryKey: ['car', id, market], queryFn: () => api.get<CarDetail>(`/cars/${encodeURIComponent(id)}`, { market }) })),
  });
  const loaded = details.map((d) => d.data).filter((d): d is CarDetail => !!d);

  // La sélection du comparateur suit la page (barre flottante cohérente).
  useEffect(() => {
    if (loaded.length === ids.length && loaded.length) setCompare(loaded.map((d) => d.summary));
  }, [loaded.length, ids.join(',')]);

  const setIds = (next: string[]) => {
    const n = new URLSearchParams(sp);
    if (next.length) n.set('ids', next.join(',')); else n.delete('ids');
    setSp(n, { replace: true });
    if (!next.length) setCompare([]);
  };

  // Variante par défaut : même niveau de gamme pour tous si possible (comparaison à périmètre égal).
  const cols = useMemo(() => loaded.map((d) => {
    const vs = d.generation.variants;
    const chosen = vs.find((v) => v.id === variantSel[d.generation.id]) ?? vs.find((v) => v.tier === 'entry') ?? vs[0] ?? null;
    return { d, v: chosen };
  }), [loaded, variantSel]);

  const tiers = new Set(cols.map((c) => c.v?.tier).filter(Boolean));
  const scopeWarning = tiers.size > 1;

  if (!ids.length) {
    return (
      <div className="page-enter">
        <header className="page-head"><span className="eyebrow">Comparateur</span><h1>Comparer des voitures</h1></header>
        <EmptyState icon={<GitCompareArrows size={28} />} title="Choisissez au moins deux voitures" message="Ajoutez des modèles depuis le catalogue, une fiche ou votre wishlist avec l’icône de comparaison, ou recherchez-les ci-dessous." />
        <div style={{ maxWidth: 480, margin: 'var(--space-5) auto 0' }}><AddCar exclude={[]} onAdd={(id) => setIds([id])} /></div>
      </div>
    );
  }

  const rows = SPECS.filter((s) => cols.some((c) => c.v && s.display(c.v, market) != null));
  const summary = rows.filter((s) => s.value).map((s) => {
    const vals = cols.map((c) => ({ name: `${c.d.brand.name} ${c.d.generation.modelName}`, val: c.v ? s.value!(c.v, market) : null, txt: c.v ? s.display(c.v, market) : null })).filter((x) => x.val != null);
    if (vals.length < 2) return null;
    const max = vals.reduce((a, b) => (b.val! > a.val! ? b : a));
    const min = vals.reduce((a, b) => (b.val! < a.val! ? b : a));
    if (max.val === min.val) return `${s.label} : identique (${max.txt}).`;
    return `${s.label} : de ${min.txt} (${min.name}) à ${max.txt} (${max.name}).`;
  }).filter((x): x is string => !!x);

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Comparateur</span>
        <h1>Face à face</h1>
        <p>Données côte à côte, version par version, pour le marché {marketInfo(market).name}. Aucun classement global : les écarts sont présentés factuellement.</p>
      </header>

      {details.some((d) => d.isError) && <ErrorState message="Une des fiches n’a pas pu être chargée." onRetry={() => details.forEach((d) => d.refetch())} />}
      {scopeWarning && <Notice tone="warning">Les versions comparées n’appartiennent pas au même niveau de gamme (entrée, sportive, haut de gamme). Changez de version au-dessus de chaque colonne pour comparer à périmètre égal.</Notice>}

      <div className="compare-scroll">
        <table className="compare-table" style={{ '--cols': cols.length } as React.CSSProperties}>
          <thead>
            <tr>
              <th className="compare-corner" scope="col"><span className="sr-only">Caractéristique</span>{ids.length < COMPARE_MAX && <AddCar exclude={ids} onAdd={(id) => setIds([...ids, id])} />}</th>
              {cols.map(({ d, v }) => (
                <th key={d.generation.id} scope="col" className="compare-head">
                  <div className="compare-media car-media"><CarImage image={d.images[0] ?? null} alt={`${d.brand.name} ${d.generation.modelName}`} /></div>
                  <div className="row between gap-2" style={{ alignItems: 'flex-start' }}>
                    <Link to={`/voiture/${d.generation.id}`} className="stack" style={{ textAlign: 'left' }}>
                      <span className="eyebrow">{d.brand.name}</span>
                      <strong style={{ fontSize: 'var(--text-lg)' }}>{d.generation.modelName}</strong>
                      <span className="subtle" style={{ fontSize: 12 }}>{d.generation.name}</span>
                    </Link>
                    <button type="button" className="icon-btn" aria-label={`Retirer ${d.brand.name} ${d.generation.modelName}`} data-tip="Retirer" onClick={() => setIds(ids.filter((x) => x !== d.generation.id))}><X size={16} /></button>
                  </div>
                  {d.generation.variants.length > 1 ? (
                    <select className="select" aria-label="Version comparée" value={v?.id} onChange={(e) => setVariantSel({ ...variantSel, [d.generation.id]: e.target.value })}>
                      {[...d.generation.variants].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  ) : <span className="muted" style={{ fontSize: 12 }}>{v ? `Version : ${v.name}` : 'Aucune version documentée'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          {SPEC_GROUPS.map((g) => {
            const gr = rows.filter((s) => s.group === g);
            if (!gr.length) return null;
            return (
              <tbody key={g}>
                <tr className="compare-group"><th colSpan={cols.length + 1} scope="colgroup">{g}</th></tr>
                {gr.map((s) => (
                  <tr key={s.key}>
                    <th scope="row">{s.label}</th>
                    {cols.map(({ d, v }) => {
                      const txt = v ? s.display(v, market) : null;
                      return <td key={d.generation.id} className="num">{txt ?? <span className="subtle">Non disponible</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
          <tbody>
            <tr>
              <th scope="row">Date de commercialisation</th>
              {cols.map(({ d }) => {
                const s = d.summary;
                // On nomme l'étape réellement datée : une présentation n'est pas une mise en vente.
                const txt = !s.isUpcoming ? d.generation.yearsLabel
                  : s.releaseDate && s.releaseDateKind ? `${MILESTONE_LABELS[s.releaseDateKind]} : ${formatPartialDate(s.releaseDate)}` : 'Non annoncée';
                return <td key={d.generation.id}>{txt}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {details.some((d) => d.isLoading) && <div className="skeleton" style={{ height: 120, marginTop: 16 }} />}

      {summary.length > 0 && (
        <section className="section panel">
          <h3>Synthèse des différences</h3>
          <p className="subtle" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>Écarts entre les versions sélectionnées. Aucune voiture n’est déclarée « meilleure » : tout dépend de l’usage.</p>
          <ul className="bullet-list">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
