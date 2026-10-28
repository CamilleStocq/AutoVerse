import { useNews } from '../../hooks/queries';
import { NewsCard, NewsSkeleton } from '../../components/NewsCard';
import { ErrorState, Freshness, Notice } from '../../components/States';

export function SportNews({ scope }: { scope: 'f1' | 'wec' | 'wrc' }) {
  const news = useNews({ scope, pageSize: 6 });
  const first = news.data?.pages[0];
  return (
    <section className="stack gap-4">
      <div className="section-head" style={{ margin: 0 }}>
        <div><h2>Actualités</h2><p>Transferts, annonces des équipes, règlements et techniques. Une information rapportée par la presse n’est pas une annonce officielle.</p></div>
      </div>
      {news.isLoading && <NewsSkeleton count={3} />}
      {news.isError && <ErrorState message="Le flux d’actualités ne répond pas." onRetry={() => news.refetch()} />}
      {first && (first.data.items.length
        ? <div className="news-grid">{first.data.items.map((n) => <NewsCard key={n.id} item={n} />)}</div>
        : <Notice>Aucune actualité récente dans les flux suivis.</Notice>)}
      {first && <Freshness fetchedAt={first.fetchedAt} stale={first.stale} errors={first.errors} label="Flux mis à jour" />}
    </section>
  );
}
