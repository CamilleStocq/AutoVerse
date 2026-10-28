/**
 * « Ma collection » (onglet d'Explorer) : boosters tirés parmi les marques préférées,
 * albums par marque avec les cartes manquantes, échange de doubles.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeftRight, PackageOpen } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { useCars, useMeta } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';
import { EXCHANGE_COST, useCollection } from '../state/collection';
import { TradingCard } from './TradingCard';
import { BoosterOpening, type DrawnCard } from './BoosterOpening';
import { ErrorState } from './States';

/** Paquet des boosters : les marques préférées (ou tout le catalogue si aucune n'est choisie). */
export function useBoosterPool() {
  const { preferences } = useProfile();
  const cars = useCars({ pageSize: 100, personalize: false });
  const favorite = Array.isArray(preferences.brands) ? preferences.brands : [];
  const all = cars.data?.items ?? [];
  const pool = favorite.length ? all.filter((c) => favorite.includes(c.brandId)) : all;
  return { cars, all, pool: pool.length ? pool : all, favorite };
}

export function Collection() {
  const { cars, all, pool, favorite } = useBoosterPool();
  const meta = useMeta();
  const { state, owned, doubles, openBooster, exchange } = useCollection();
  const { toast } = useUi();
  const [opening, setOpening] = useState<DrawnCard[] | null>(null);
  const [exchangeMode, setExchangeMode] = useState(false);

  const albums = useMemo(() => {
    const byBrand = new Map<string, CarSummary[]>();
    for (const c of all) byBrand.set(c.brandId, [...(byBrand.get(c.brandId) ?? []), c]);
    const list = [...byBrand.entries()].map(([brandId, cards]) => ({
      brandId,
      name: cards[0].brandName,
      accent: cards[0].brandAccent,
      cards: [...cards].sort((a, b) => (a.card?.number ?? 0) - (b.card?.number ?? 0)),
      owned: cards.filter((c) => owned[c.id]).length,
      favorite: favorite.includes(brandId),
    }));
    // Mes marques d'abord, puis les albums les plus avancés.
    return list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.owned - a.owned || a.name.localeCompare(b.name));
  }, [all, owned, favorite]);

  const ownedCount = all.filter((c) => owned[c.id]).length;
  const brandNames = favorite.map((id) => meta.data?.brands.find((b) => b.id === id)?.name).filter(Boolean);
  const packLabel = brandNames.length ? brandNames.slice(0, 3).join(' · ') + (brandNames.length > 3 ? ' …' : '') : 'Toutes les marques';

  const open = () => {
    const drawn = openBooster(pool);
    if (drawn) setOpening(drawn);
  };

  const onLockedClick = (car: CarSummary) => {
    if (!exchangeMode) return;
    if (exchange(car)) {
      toast(`${car.brandName} ${car.modelName} rejoint votre collection`);
      setExchangeMode(false);
    }
  };

  if (cars.isError) return <ErrorState message="Le catalogue ne répond pas." onRetry={() => cars.refetch()} />;

  return (
    <div className="stack gap-5">
      <section className="collection-hero">
        <div className="stack gap-1">
          <span className="eyebrow">Ma collection</span>
          <strong className="collection-count num">{ownedCount}<small> / {all.length || '…'} cartes</small></strong>
          <div className="collection-bar" aria-hidden="true"><i style={{ width: `${all.length ? (ownedCount / all.length) * 100 : 0}%` }} /></div>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {state.boosters > 0
              ? `${state.boosters} booster${state.boosters > 1 ? 's' : ''} à ouvrir`
              : 'Prochain booster demain (1 par jour, jusqu’à 3 en réserve)'}
          </span>
        </div>
        <button type="button" className="btn btn-primary booster-cta" onClick={open} disabled={state.boosters < 1 || !pool.length}>
          <PackageOpen size={20} /> Ouvrir un booster
          {state.boosters > 0 && <span className="booster-count num">{state.boosters}</span>}
        </button>
        <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>Les boosters contiennent 5 cartes de {favorite.length ? 'vos marques préférées' : 'toutes les marques'} (modifiables dans votre profil), dont au moins une Rare.</p>
      </section>

      <section className={`panel exchange-panel${exchangeMode ? ' active' : ''}`}>
        <div className="row between gap-3 wrap">
          <span><strong className="num">{doubles}</strong> double{doubles > 1 ? 's' : ''} · {EXCHANGE_COST} doubles = 1 carte manquante au choix</span>
          <button type="button" className="btn btn-sm" disabled={doubles < EXCHANGE_COST} onClick={() => setExchangeMode(!exchangeMode)}>
            <ArrowLeftRight size={16} /> {exchangeMode ? 'Annuler l’échange' : 'Échanger'}
          </button>
        </div>
        {exchangeMode && <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>Touchez une carte manquante (« ? ») dans un album pour l’obtenir.</p>}
      </section>

      {cars.isLoading && <div className="skeleton" style={{ height: 300 }} />}

      {albums.map((a) => (
        <section key={a.brandId} className="album" style={{ '--brand-accent': a.accent } as CSSProperties}>
          <header className="album-head">
            <h2>{a.name}{a.favorite && <span className="badge plain accent" style={{ marginLeft: 8 }}>Ma marque</span>}</h2>
            <span className="num muted">{a.owned} / {a.cards.length}</span>
          </header>
          <div className="collection-bar small" aria-hidden="true"><i style={{ width: `${(a.owned / a.cards.length) * 100}%` }} /></div>
          <div className="tcard-grid">
            {a.cards.map((c) => (owned[c.id]
              ? <TradingCard key={c.id} car={c} count={owned[c.id].count} />
              : <TradingCard key={c.id} car={c} locked onClick={exchangeMode ? () => onLockedClick(c) : undefined} />))}
          </div>
        </section>
      ))}

      {opening && <BoosterOpening cards={opening} packLabel={packLabel} onClose={() => setOpening(null)} />}
    </div>
  );
}
