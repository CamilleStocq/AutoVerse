import { useDeferredValue, useState } from 'react';
import { Search } from 'lucide-react';
import type { NewsCategory } from '@shared/api';
import { NEWS_CATEGORY_LABELS } from '@shared/labels';
import { useMeta, useNews } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { NewsCard, NewsSkeleton } from '../components/NewsCard';
import { EmptyState, ErrorState, Freshness } from '../components/States';

const CATS = (Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[]).filter((c) => c !== 'other');

export function News() {
  const { preferences } = useProfile();
  const meta = useMeta();
  const myBrands = Array.isArray(preferences.brands) ? preferences.brands : [];
  const [mode, setMode] = useState<'mine' | 'all'>(myBrands.length ? 'mine' : 'all');
  const [cats, setCats] = useState<NewsCategory[]>([]);
  const [brand, setBrand] = useState('');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim());
  const news = useNews({ personal: mode === 'mine', categories: cats, brands: brand ? [brand] : undefined, q: dq || undefined, pageSize: 18 });
  const items = news.data?.pages.flatMap((p) => p.data.items) ?? [];
  const first = news.data?.pages[0];

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Actualité</span>
        <h1>L’actualité automobile</h1>
        <p>Communiqués officiels des constructeurs et presse automobile reconnue, dédoublonnés. Les dates affichées sont celles de publication des articles.</p>
      </header>

      <div className="explore-bar">
        <label className="search" style={{ flex: 1 }}>
          <span className="sr-only">Rechercher dans l’actualité</span>
          <Search size={18} />
          <input className="input" type="search" placeholder="Rechercher : batterie, Porsche, rappel…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {myBrands.length > 0 && (
          <div className="segmented" role="group" aria-label="Personnalisation">
            <button type="button" aria-pressed={mode === 'mine'} onClick={() => setMode('mine')}>Mes marques d’abord</button>
            <button type="button" aria-pressed={mode === 'all'} onClick={() => setMode('all')}>Toute l’actualité</button>
          </div>
        )}
        <select className="select" style={{ width: 'auto' }} aria-label="Filtrer par marque" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Toutes les marques</option>
          {meta.data?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="chip-scroll" style={{ margin: 'var(--space-4) 0 var(--space-5)' }}>
        <button type="button" className="chip" aria-pressed={!cats.length} onClick={() => setCats([])}>Tout</button>
        {CATS.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>{NEWS_CATEGORY_LABELS[c]}</button>
        ))}
      </div>

      {news.isLoading ? <NewsSkeleton count={6} /> : news.isError ? (
        <ErrorState message="Les flux d’actualité sont momentanément indisponibles." onRetry={() => news.refetch()} />
      ) : items.length ? (
        <>
          <div className="news-grid">{items.map((n) => <NewsCard key={n.id} item={n} />)}</div>
          {news.hasNextPage && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <button type="button" className="btn" onClick={() => news.fetchNextPage()} disabled={news.isFetchingNextPage}>{news.isFetchingNextPage ? 'Chargement…' : 'Afficher plus d’articles'}</button>
            </div>
          )}
        </>
      ) : <EmptyState title="Aucun article ne correspond" message="Élargissez les catégories ou la recherche." />}

      {first && (
        <footer className="news-footer">
          <Freshness fetchedAt={first.fetchedAt} stale={first.stale} errors={first.errors} label="Flux mis à jour" />
          <p className="provenance">Sources : {first.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>)}. Seuls le titre, un court extrait et le lien de l’article original sont repris.</p>
        </footer>
      )}
    </div>
  );
}
