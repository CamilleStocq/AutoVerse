import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Rows3, SlidersHorizontal, Search, X } from 'lucide-react';
import type { CategoryId, Powertrain, PriceRange } from '@shared/types';
import { CATEGORY_LABELS, POWERTRAIN_LABELS, PRICE_RANGE_LABELS } from '@shared/labels';
import { useInfiniteCars, useMeta, type CarFilters } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { useCollection } from '../state/collection';
import { CarRow } from '../components/CarCard';
import { TradingCard } from '../components/TradingCard';
import { Collection } from '../components/Collection';
import { KEYS, readLocal, writeLocal } from '../state/storage';
import { EmptyState, ErrorState } from '../components/States';
import { Sheet } from '../components/Sheet';

type ExploreView = 'cards' | 'list';

const SORTS = [
  { id: 'relevance', label: 'Pour vous' },
  { id: 'newest', label: 'Nouveautés' },
  { id: 'power', label: 'Puissance' },
  { id: 'price-asc', label: 'Prix croissant' },
  { id: 'price-desc', label: 'Prix décroissant' },
  { id: 'release', label: 'Date de sortie' },
];

const STATUSES = [
  { id: 'on-sale', label: 'Commercialisés' },
  { id: 'upcoming', label: 'À venir' },
  { id: 'discontinued', label: 'Anciennes générations' },
];

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

function toggleIn(sp: URLSearchParams, key: string, value: string): URLSearchParams {
  const next = new URLSearchParams(sp);
  const cur = list(sp.get(key));
  const updated = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
  if (updated.length) next.set(key, updated.join(',')); else next.delete(key);
  return next;
}

function CardGridSkeleton() {
  return (
    <div className="tcard-grid" aria-busy="true" aria-label="Chargement en cours">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '63 / 88', borderRadius: 12 }} />)}
    </div>
  );
}

function Catalogue() {
  const [sp, setSp] = useSearchParams();
  const { preferences } = useProfile();
  const { owned } = useCollection();
  const meta = useMeta();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const deferredQ = useDeferredValue(q);
  const [sheet, setSheet] = useState(false);
  // Cartes à collectionner par défaut ; le choix est mémorisé sur l'appareil.
  const [view, setViewState] = useState<ExploreView>(() => (readLocal<string>(KEYS.exploreView, 'cards') === 'list' ? 'list' : 'cards'));
  const setView = (v: ExploreView) => { setViewState(v); writeLocal(KEYS.exploreView, v); };

  // Recherche instantanée, reflétée dans l'URL (partageable, retour arrière fonctionnel).
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp);
      if (q.trim()) next.set('q', q.trim()); else next.delete('q');
      if (next.toString() !== sp.toString()) setSp(next, { replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const filters: CarFilters = {
    q: deferredQ.trim() || undefined,
    brands: list(sp.get('brands')),
    categories: list(sp.get('categories')),
    powertrains: list(sp.get('powertrains')),
    priceRanges: list(sp.get('priceRanges')),
    status: list(sp.get('status')),
    yearFrom: sp.get('yearFrom') ? Number(sp.get('yearFrom')) : null,
    yearTo: sp.get('yearTo') ? Number(sp.get('yearTo')) : null,
    sort: sp.get('sort') ?? 'relevance',
    pageSize: 18,
  };
  const cars = useInfiniteCars(filters);
  const items = cars.data?.pages.flatMap((p) => p.items) ?? [];
  const total = cars.data?.pages[0]?.total ?? 0;

  const activeCount = ['brands', 'categories', 'powertrains', 'priceRanges', 'status'].reduce((n, k) => n + list(sp.get(k)).length, 0)
    + (sp.get('yearFrom') ? 1 : 0) + (sp.get('yearTo') ? 1 : 0);
  const myBrands = Array.isArray(preferences.brands) ? preferences.brands : [];

  const brandName = useMemo(() => new Map(meta.data?.brands.map((b) => [b.id, b.name]) ?? []), [meta.data]);
  const activeChips: Array<{ key: string; value: string; label: string }> = [
    ...list(sp.get('brands')).map((v) => ({ key: 'brands', value: v, label: brandName.get(v) ?? v })),
    ...list(sp.get('categories')).map((v) => ({ key: 'categories', value: v, label: CATEGORY_LABELS[v as CategoryId] ?? v })),
    ...list(sp.get('powertrains')).map((v) => ({ key: 'powertrains', value: v, label: POWERTRAIN_LABELS[v as Powertrain] ?? v })),
    ...list(sp.get('priceRanges')).map((v) => ({ key: 'priceRanges', value: v, label: PRICE_RANGE_LABELS[v as PriceRange] ?? v })),
    ...list(sp.get('status')).map((v) => ({ key: 'status', value: v, label: STATUSES.find((s) => s.id === v)?.label ?? v })),
  ];

  const applyMine = () => {
    const next = new URLSearchParams(sp);
    if (myBrands.length) next.set('brands', myBrands.join(',')); else next.delete('brands');
    if (preferences.categories.length) next.set('categories', preferences.categories.join(',')); else next.delete('categories');
    setSp(next);
  };

  return (
    <>
      <div className="explore-sticky">
        <div className="explore-bar">
          <label className="search" style={{ flex: 1 }}>
            <span className="sr-only">Rechercher un modèle ou une marque</span>
            <Search size={18} />
            <input className="input" type="search" placeholder="Rechercher : 911, Ioniq, break, GTI…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="row gap-2">
            <span className="sr-only">Trier par</span>
            <select className="select" value={filters.sort} onChange={(e) => { const n = new URLSearchParams(sp); n.set('sort', e.target.value); setSp(n, { replace: true }); }}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>Tri : {s.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => setSheet(true)}>
            <SlidersHorizontal size={18} /> Filtres{activeCount ? ` (${activeCount})` : ''}
          </button>
          <div className="segmented" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')} aria-label="Cartes à collectionner" data-tip="Cartes"><LayoutGrid size={16} /> Cartes</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="Liste compacte" data-tip="Liste"><Rows3 size={16} /> Liste</button>
          </div>
        </div>
      </div>

      <div className="chip-scroll" style={{ margin: 'var(--space-4) 0' }}>
        {(myBrands.length > 0 || preferences.categories.length > 0) && (
          <button type="button" className="chip" onClick={applyMine}>Mes marques et catégories</button>
        )}
        {(['sports', 'sport-suv', 'ev', 'supercar', 'wagon', 'city', 'classic'] as CategoryId[]).map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={list(sp.get('categories')).includes(c)} onClick={() => setSp(toggleIn(sp, 'categories', c))}>{CATEGORY_LABELS[c]}</button>
        ))}
      </div>

      {activeChips.length > 0 && (
        <div className="row gap-2 wrap" style={{ marginBottom: 'var(--space-4)' }}>
          {activeChips.map((c) => (
            <button key={c.key + c.value} type="button" className="chip" aria-pressed="true" onClick={() => setSp(toggleIn(sp, c.key, c.value))} aria-label={`Retirer le filtre ${c.label}`}>
              {c.label} <X size={14} />
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const n = new URLSearchParams(); if (sp.get('q')) n.set('q', sp.get('q')!); setSp(n); }}>Tout effacer</button>
        </div>
      )}

      <p className="muted num" aria-live="polite" style={{ fontSize: 'var(--text-sm)', margin: 'var(--space-3) 0' }}>
        {cars.isLoading ? 'Chargement…' : `${total} carte${total > 1 ? 's' : ''} · ${items.filter((c) => owned[c.id]).length} dans votre collection`}
      </p>

      {cars.isLoading ? <CardGridSkeleton /> : cars.isError ? (
        <ErrorState message="Le catalogue ne répond pas. Vos favoris restent accessibles hors ligne." onRetry={() => cars.refetch()} />
      ) : items.length ? (
        <>
          <div className={view === 'cards' ? 'tcard-grid' : 'car-list'} style={{ opacity: cars.isPlaceholderData ? 0.6 : 1, transition: 'opacity var(--dur-base)' }}>
            {items.map((c) => (view === 'cards'
              ? <TradingCard key={c.id} car={c} count={owned[c.id]?.count} badge={owned[c.id] ? 'Possédée' : undefined} />
              : <CarRow key={c.id} car={c} />))}
          </div>
          {cars.hasNextPage && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <button type="button" className="btn" onClick={() => cars.fetchNextPage()} disabled={cars.isFetchingNextPage}>
                {cars.isFetchingNextPage ? 'Chargement…' : `Afficher plus (${total - items.length} restantes)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="Aucune voiture ne correspond" message="Essayez d’élargir vos filtres ou de modifier votre recherche." action={<button type="button" className="btn btn-sm" onClick={() => { setQ(''); setSp(new URLSearchParams()); }}>Réinitialiser</button>} />
      )}

      <Sheet
        open={sheet}
        title="Filtres"
        onClose={() => setSheet(false)}
        footer={<>
          <button type="button" className="btn" onClick={() => setSp(new URLSearchParams(sp.get('q') ? { q: sp.get('q')! } : {}))}>Effacer</button>
          <button type="button" className="btn btn-primary" onClick={() => setSheet(false)}>Voir {total} résultat{total > 1 ? 's' : ''}</button>
        </>}
      >
        <div className="sheet-group">
          <span className="label">Statut</span>
          <div className="chip-row">{STATUSES.map((s) => <button key={s.id} type="button" className="chip" aria-pressed={list(sp.get('status')).includes(s.id)} onClick={() => setSp(toggleIn(sp, 'status', s.id))}>{s.label}</button>)}</div>
        </div>
        <div className="sheet-group">
          <span className="label">Catégorie</span>
          <div className="chip-row">{meta.data?.categories.filter((c) => c.count > 0).map((c) => <button key={c.id} type="button" className="chip" aria-pressed={list(sp.get('categories')).includes(c.id)} onClick={() => setSp(toggleIn(sp, 'categories', c.id))}>{c.label} <span className="subtle num">{c.count}</span></button>)}</div>
        </div>
        <div className="sheet-group">
          <span className="label">Motorisation</span>
          <div className="chip-row">{meta.data?.powertrains.filter((c) => c.count > 0).map((c) => <button key={c.id} type="button" className="chip" aria-pressed={list(sp.get('powertrains')).includes(c.id)} onClick={() => setSp(toggleIn(sp, 'powertrains', c.id))}>{c.label} <span className="subtle num">{c.count}</span></button>)}</div>
        </div>
        <div className="sheet-group">
          <span className="label">Gamme de prix</span>
          <div className="chip-row">{(Object.keys(PRICE_RANGE_LABELS) as PriceRange[]).map((p) => <button key={p} type="button" className="chip" aria-pressed={list(sp.get('priceRanges')).includes(p)} onClick={() => setSp(toggleIn(sp, 'priceRanges', p))}>{PRICE_RANGE_LABELS[p]}</button>)}</div>
        </div>
        <div className="sheet-group">
          <span className="label">Année de lancement</span>
          <div className="row gap-3">
            {(['yearFrom', 'yearTo'] as const).map((k) => (
              <label key={k} className="field" style={{ flex: 1 }}>
                <span style={{ fontSize: 'var(--text-xs)' }} className="muted">{k === 'yearFrom' ? 'Depuis' : 'Jusqu’à'}</span>
                <input className="input num" type="number" inputMode="numeric" min={meta.data?.years?.min} max={meta.data?.years?.max} placeholder={String(k === 'yearFrom' ? meta.data?.years?.min ?? '' : meta.data?.years?.max ?? '')}
                  value={sp.get(k) ?? ''} onChange={(e) => { const n = new URLSearchParams(sp); if (e.target.value) n.set(k, e.target.value); else n.delete(k); setSp(n, { replace: true }); }} />
              </label>
            ))}
          </div>
        </div>
        <div className="sheet-group">
          <span className="label">Marque</span>
          <div className="chip-row">{meta.data?.brands.filter((b) => b.carCount > 0).map((b) => <button key={b.id} type="button" className="chip" aria-pressed={list(sp.get('brands')).includes(b.id)} onClick={() => setSp(toggleIn(sp, 'brands', b.id))}>{b.name} <span className="subtle num">{b.carCount}</span></button>)}</div>
        </div>
      </Sheet>
    </>
  );
}

export function Explore() {
  const [sp, setSp] = useSearchParams();
  const { state } = useCollection();
  const tab = sp.get('onglet') === 'collection' ? 'collection' : 'catalogue';
  const setTab = (t: 'catalogue' | 'collection') => {
    // Changer d'onglet repart d'une sélection vierge (les filtres du catalogue ne concernent pas l'album).
    setSp(t === 'collection' ? new URLSearchParams({ onglet: 'collection' }) : new URLSearchParams(), { replace: true });
  };
  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Explorer</span>
        <h1>{tab === 'collection' ? 'Ma collection' : 'Le catalogue'}</h1>
        <p>{tab === 'collection'
          ? 'Ouvrez des boosters de vos marques préférées et complétez vos albums de cartes.'
          : 'Chaque voiture est une carte à collectionner. Touchez une carte pour sa fiche complète.'}</p>
      </header>
      <nav className="tabs" aria-label="Explorer" style={{ marginBottom: 'var(--space-5)' }}>
        <button type="button" aria-selected={tab === 'catalogue'} onClick={() => setTab('catalogue')}>Catalogue</button>
        <button type="button" aria-selected={tab === 'collection'} onClick={() => setTab('collection')} style={{ '--tab-accent': 'var(--accent)' } as CSSProperties}>
          Ma collection{state.boosters > 0 && <span className="tab-badge num">{state.boosters}</span>}
        </button>
      </nav>
      {tab === 'collection' ? <Collection /> : <Catalogue />}
    </div>
  );
}
