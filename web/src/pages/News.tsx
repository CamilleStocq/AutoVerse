import { useDeferredValue, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useMeta, useNews } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { NewsCard, NewsSkeleton } from '../components/NewsCard';
import { EmptyState, ErrorState, Freshness } from '../components/States';

type Scope = 'auto' | 'f1' | 'wec' | 'wrc';

const TABS: Array<{ id: Scope; label: string; accent?: string; intro: string }> = [
  { id: 'auto', label: 'Futures sorties', intro: 'Annonces, présentations, prochaines générations et dates de commercialisation des nouveaux modèles.' },
  { id: 'f1', label: 'Formule 1', accent: 'var(--f1)', intro: 'Transferts, annonces des équipes, règlements et évolutions techniques.' },
  { id: 'wec', label: 'WEC', accent: 'var(--wec)', intro: 'Endurance : Hypercar, LMGT3, 24 Heures du Mans, équipages et constructeurs.' },
  { id: 'wrc', label: 'WRC', accent: 'var(--wrc)', intro: 'Rallye : équipes, pilotes et copilotes, voitures et règlements.' },
];

export function News() {
  const { preferences } = useProfile();
  const meta = useMeta();
  const [sp, setSp] = useSearchParams();
  const scope = (TABS.find((t) => t.id === sp.get('rubrique'))?.id ?? 'auto') as Scope;
  const myBrands = Array.isArray(preferences.brands) ? preferences.brands : [];
  const [mineFirst, setMineFirst] = useState(myBrands.length > 0);
  const [brand, setBrand] = useState('');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim());
  const isAuto = scope === 'auto';
  const news = useNews({
    scope,
    personal: isAuto && mineFirst,
    brands: isAuto && brand ? [brand] : undefined,
    q: dq || undefined,
    pageSize: 18,
  });
  const items = news.data?.pages.flatMap((p) => p.data.items) ?? [];
  const first = news.data?.pages[0];
  const tab = TABS.find((t) => t.id === scope)!;

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Actualité</span>
        <h1>L’actualité qui compte</h1>
        <p>Les futures sorties de modèles et le sport automobile. Sources officielles et presse spécialisée, doublons regroupés ; les dates affichées sont celles de publication.</p>
      </header>

      <nav className="tabs" aria-label="Rubriques" style={{ marginBottom: 'var(--space-5)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-selected={scope === t.id}
            style={t.accent ? ({ '--tab-accent': t.accent } as CSSProperties) : undefined}
            onClick={() => { const n = new URLSearchParams(sp); if (t.id === 'auto') n.delete('rubrique'); else n.set('rubrique', t.id); setSp(n, { replace: true }); setBrand(''); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <p className="muted" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>{tab.intro}</p>

      <div className="explore-bar" style={{ marginBottom: 'var(--space-5)' }}>
        <label className="search" style={{ flex: 1 }}>
          <span className="sr-only">Rechercher dans l’actualité</span>
          <Search size={18} />
          <input className="input" type="search" placeholder={isAuto ? 'Rechercher : Alpine, électrique, 2027…' : 'Rechercher : pilote, équipe, circuit…'} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {isAuto && myBrands.length > 0 && (
          <div className="segmented" role="group" aria-label="Ordre">
            <button type="button" aria-pressed={mineFirst} onClick={() => setMineFirst(true)}>Mes marques d’abord</button>
            <button type="button" aria-pressed={!mineFirst} onClick={() => setMineFirst(false)}>Plus récentes</button>
          </div>
        )}
        {isAuto && (
          <select className="select" style={{ width: 'auto' }} aria-label="Filtrer par marque" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Toutes les marques</option>
            {meta.data?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
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
      ) : <EmptyState title="Aucun article ne correspond" message={isAuto ? 'Aucune annonce de sortie récente pour ces critères.' : 'Élargissez la recherche.'} />}

      {first && (
        <footer className="news-footer">
          <Freshness fetchedAt={first.fetchedAt} stale={first.stale} errors={first.errors} label="Flux mis à jour" />
          <p className="provenance">Sources : {first.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>)}. Seuls le titre, un court extrait et le lien de l’article original sont repris.</p>
        </footer>
      )}
    </div>
  );
}
