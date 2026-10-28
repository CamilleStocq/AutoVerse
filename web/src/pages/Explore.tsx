/**
 * Explorer : uniquement une recherche. Aucune carte n'est affichée tant qu'on ne cherche rien ;
 * la carte et la fiche d'un modèle apparaissent seulement quand on le recherche.
 * (Les cartes possédées sont rangées dans l'onglet Deck.)
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useCards, useInfiniteCars } from '../hooks/queries';
import { cardKey, useCollection } from '../state/collection';
import { TradingCard } from '../components/TradingCard';
import { EmptyState, ErrorState } from '../components/States';

function CardGridSkeleton() {
  return (
    <div className="tcard-grid" aria-busy="true" aria-label="Chargement en cours">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '63 / 88', borderRadius: 12 }} />)}
    </div>
  );
}

function Results({ q }: { q: string }) {
  const { owned } = useCollection();
  const allCards = useCards();
  // Versions possédées par fiche (la recherche montre une fiche, le deck une carte par version).
  const ownedByCar = useMemo(() => {
    const m: Record<string, { owned: number; total: number }> = {};
    for (const c of allCards.data ?? []) {
      const e = (m[c.id] ??= { owned: 0, total: 0 });
      e.total++;
      if (owned[cardKey(c)]) e.owned++;
    }
    return m;
  }, [allCards.data, owned]);

  const cars = useInfiniteCars({ q, sort: 'relevance', pageSize: 12, personalize: false });
  const items = cars.data?.pages.flatMap((p) => p.items) ?? [];
  const total = cars.data?.pages[0]?.total ?? 0;

  if (cars.isLoading) return <CardGridSkeleton />;
  if (cars.isError) return <ErrorState message="La recherche ne répond pas pour le moment." onRetry={() => cars.refetch()} />;
  if (!items.length) return <EmptyState title="Aucun modèle trouvé" message="Vérifiez l’orthographe ou essayez le nom de la marque." />;

  return (
    <>
      <p className="muted num" aria-live="polite" style={{ fontSize: 'var(--text-sm)', margin: 'var(--space-3) 0' }}>
        {total} résultat{total > 1 ? 's' : ''}
      </p>
      <div className="tcard-grid" style={{ opacity: cars.isPlaceholderData ? 0.6 : 1, transition: 'opacity var(--dur-base)' }}>
        {items.map((c) => (
          <TradingCard key={c.id} car={c} badge={ownedByCar[c.id]?.owned ? `Deck ${ownedByCar[c.id].owned}/${ownedByCar[c.id].total}` : undefined} />
        ))}
      </div>
      {cars.hasNextPage && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
          <button type="button" className="btn" onClick={() => cars.fetchNextPage()} disabled={cars.isFetchingNextPage}>
            {cars.isFetchingNextPage ? 'Chargement…' : `Afficher plus (${total - items.length} restants)`}
          </button>
        </div>
      )}
    </>
  );
}

export function Explore() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const query = useDeferredValue(q.trim());

  // Recherche reflétée dans l'URL (retour arrière depuis une fiche : la recherche est conservée).
  useEffect(() => {
    const t = setTimeout(() => {
      const next = query ? new URLSearchParams({ q: query }) : new URLSearchParams();
      if (next.toString() !== sp.toString()) setSp(next, { replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Ancien lien « Explorer › Mon deck » : la collection a désormais son propre onglet.
  if (sp.get('onglet') === 'collection') return <Navigate to="/deck" replace />;

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Explorer</span>
        <h1>Rechercher</h1>
        <p>Tapez un modèle ou une marque pour voir sa carte et sa fiche complète. Pour l’avoir dans votre deck, il faudra la tirer dans un booster.</p>
      </header>
      <div className="explore-bar">
        <label className="search" style={{ flex: 1 }}>
          <span className="sr-only">Rechercher un modèle ou une marque</span>
          <Search size={18} />
          <input className="input" type="search" enterKeyHint="search" placeholder="911, Ioniq 5, Alpine, GTI…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {q && <button type="button" className="btn" aria-label="Effacer la recherche" onClick={() => setQ('')}><X size={18} /></button>}
      </div>
      <div style={{ marginTop: 'var(--space-4)' }}>
        {query ? <Results q={query} /> : (
          <EmptyState icon={<Search size={28} />} title="Quel modèle cherchez-vous ?" message="Les cartes apparaissent ici dès que vous recherchez un modèle." />
        )}
      </div>
    </div>
  );
}
