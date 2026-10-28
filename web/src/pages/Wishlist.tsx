import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, GitCompareArrows, Heart, LayoutGrid, Rows3, Trash2 } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import type { CategoryId, Powertrain } from '@shared/types';
import { CATEGORY_LABELS, CONFIRMATION_LABELS, POWERTRAIN_LABELS, STATUS_LABELS } from '@shared/labels';
import { formatPartialDate } from '@shared/dates';
import { useCars } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { useUi, COMPARE_MAX } from '../state/UiProvider';
import { CarCard, powertrainLabel } from '../components/CarCard';
import { EmptyState, Notice } from '../components/States';
import { priceLine } from '../components/PriceTag';
import { formatDate } from '../lib/format';

type Sort = 'added' | 'brand' | 'price' | 'power';

export function Wishlist() {
  const { wishlist, removeWish, preferences, syncState } = useProfile();
  const { setCompare, toast } = useUi();
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<Sort>('added');
  const [brand, setBrand] = useState('');
  const [cat, setCat] = useState('');
  const [pt, setPt] = useState('');
  const [status, setStatus] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  // Données à jour (prix du marché courant, statut) ; l'instantané sert de repli si la fiche a disparu.
  const ids = wishlist.map((w) => w.generationId);
  const live = useCars({ ids, pageSize: 100, personalize: false }, ids.length > 0);
  const cars: Array<{ car: CarSummary; addedAt: string; orphan: boolean }> = useMemo(() => {
    const map = new Map(live.data?.items.map((c) => [c.id, c]));
    return wishlist.map((w) => ({ car: map.get(w.generationId) ?? w.snapshot, addedAt: w.addedAt, orphan: !!live.data && !map.has(w.generationId) }));
  }, [wishlist, live.data]);

  const brands = [...new Map(cars.map((c) => [c.car.brandId, c.car.brandName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const cats = [...new Set(cars.flatMap((c) => c.car.categories))] as CategoryId[];
  const pts = [...new Set(cars.flatMap((c) => c.car.powertrains))] as Powertrain[];

  const shown = cars
    .filter(({ car }) => (!brand || car.brandId === brand) && (!cat || car.categories.includes(cat as CategoryId))
      && (!pt || car.powertrains.includes(pt as Powertrain))
      && (!status || (status === 'upcoming' ? car.isUpcoming : car.status === status && !car.isUpcoming)))
    .sort((a, b) => {
      if (sort === 'brand') return `${a.car.brandName} ${a.car.modelName}`.localeCompare(`${b.car.brandName} ${b.car.modelName}`);
      if (sort === 'price') return (a.car.startingPrice?.amount ?? Infinity) - (b.car.startingPrice?.amount ?? Infinity);
      if (sort === 'power') return (b.car.maxPowerHp ?? -1) - (a.car.maxPowerHp ?? -1);
      return b.addedAt.localeCompare(a.addedAt);
    });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), wishlist }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `autoverse-wishlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const compareSelected = () => {
    const sel = cars.filter((c) => picked.includes(c.car.id)).map((c) => c.car);
    setCompare(sel);
    navigate(`/comparer?ids=${sel.map((c) => c.id).join(',')}`);
  };

  if (!wishlist.length) {
    return (
      <div className="page-enter">
        <header className="page-head"><span className="eyebrow">Wishlist</span><h1>Mon garage de rêve</h1></header>
        <EmptyState icon={<Heart size={28} />} title="Aucune voiture pour l’instant" message="Touchez le cœur sur n’importe quelle carte ou fiche : vos favoris sont sauvegardés durablement, y compris les futurs modèles." action={<Link to="/explorer" className="btn btn-primary btn-sm">Explorer le catalogue</Link>} />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Wishlist</span>
        <h1>Mon garage de rêve</h1>
        <p>{wishlist.length} voiture{wishlist.length > 1 ? 's' : ''} · {syncState === 'synced' ? 'synchronisée' : syncState === 'syncing' ? 'synchronisation…' : syncState === 'local' ? 'enregistrée sur cet appareil' : 'enregistrée sur cet appareil, synchronisation en attente'}</p>
      </header>


      <div className="wish-toolbar">
        <div className="row gap-2 wrap" style={{ flex: 1 }}>
          <select className="select" aria-label="Filtrer par marque" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">Toutes les marques</option>{brands.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <select className="select" aria-label="Filtrer par catégorie" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Toutes catégories</option>{cats.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select>
          <select className="select" aria-label="Filtrer par motorisation" value={pt} onChange={(e) => setPt(e.target.value)}><option value="">Toutes motorisations</option>{pts.map((p) => <option key={p} value={p}>{POWERTRAIN_LABELS[p]}</option>)}</select>
          <select className="select" aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tous statuts</option><option value="on-sale">Commercialisées</option><option value="upcoming">À venir</option><option value="discontinued">Plus commercialisées</option></select>
          <select className="select" aria-label="Trier" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="added">Ajout récent</option><option value="brand">Marque</option><option value="price">Prix</option><option value="power">Puissance</option></select>
        </div>
        <div className="row gap-2">
          <div className="segmented" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Grille de cartes"><LayoutGrid size={16} /> Cartes</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="Vue compacte"><Rows3 size={16} /> Compact</button>
          </div>
          <button type="button" className="icon-btn" onClick={exportJson} aria-label="Exporter la wishlist (JSON)" data-tip="Exporter"><Download size={18} /></button>
        </div>
      </div>

      {cars.some((c) => c.orphan) && <Notice>Certaines fiches ont été retirées du catalogue : leur dernière version connue reste affichée (historique conservé).</Notice>}

      {view === 'grid' ? (
        <div className="card-grid" style={{ marginTop: 'var(--space-5)' }}>{shown.map(({ car }) => <CarCard key={car.id} car={car} />)}</div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', margin: 'var(--space-4) 0 var(--space-2)' }}>Cochez 2 à {COMPARE_MAX} voitures pour les comparer.</p>
          <div className="table-scroll">
            <table className="data-table wish-table">
              <thead><tr><th><span className="sr-only">Comparer</span></th><th>Voiture</th><th>Statut</th><th>Motorisation</th><th className="r">Puissance</th><th className="r">Prix</th><th>Sortie</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {shown.map(({ car, addedAt }) => {
                  const price = priceLine(car, preferences.market);
                  return (
                    <tr key={car.id}>
                      <td><input type="checkbox" aria-label={`Sélectionner ${car.brandName} ${car.modelName} pour comparer`} checked={picked.includes(car.id)}
                        onChange={() => setPicked((p) => (p.includes(car.id) ? p.filter((x) => x !== car.id) : p.length >= COMPARE_MAX ? (toast(`${COMPARE_MAX} voitures au maximum`), p) : [...p, car.id]))} /></td>
                      <td><Link to={`/voiture/${car.id}`} className="row gap-3"><span className="wish-thumb">{car.image && <img src={car.image.thumb} alt="" loading="lazy" />}</span><span><strong>{car.brandName} {car.modelName}</strong><br /><span className="subtle" style={{ fontSize: 12 }}>{car.generationName} · ajoutée le {formatDate(addedAt, { day: 'numeric', month: 'short' })}</span></span></Link></td>
                      <td>{car.confirmation ? CONFIRMATION_LABELS[car.confirmation] : STATUS_LABELS[car.status]}</td>
                      <td className="muted">{powertrainLabel(car) ?? '—'}</td>
                      <td className="r num">{car.keyFact?.label === 'Puissance' ? car.keyFact.value : car.maxPowerHp ? `${car.maxPowerHp} ch` : '—'}</td>
                      <td className="r num" style={price.tone === 'missing' ? { color: 'var(--text-subtle)' } : undefined}>{price.tone === 'missing' ? 'Non communiqué' : price.value}{price.tone === 'estimate' && <div className="subtle" style={{ fontSize: 11 }}>estimation</div>}</td>
                      <td className="num">{car.isUpcoming ? formatPartialDate(car.releaseDate) : car.yearsLabel}</td>
                      <td><button type="button" className="icon-btn" onClick={() => { removeWish(car.id); toast('Retirée de la wishlist'); }} aria-label={`Retirer ${car.brandName} ${car.modelName}`} data-tip="Retirer"><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} disabled={picked.length < 2} onClick={compareSelected}>
            <GitCompareArrows size={18} /> Comparer la sélection ({picked.length})
          </button>
        </>
      )}
      {!shown.length && <p className="muted" style={{ marginTop: 'var(--space-4)' }}>Aucun favori ne correspond à ces filtres.</p>}
    </div>
  );
}
