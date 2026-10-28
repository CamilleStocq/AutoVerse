import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { CATEGORY_LABELS, CONFIRMATION_LABELS, MILESTONE_LABELS, isUnconfirmed } from '@shared/labels';
import { formatPartialDate, partialDateRange, releaseWindow } from '@shared/dates';
import { useCars, useF1, useMeta, useNews, useSportCalendar } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { CarCard } from '../components/CarCard';
import { CarImage } from '../components/CarImage';
import { CardGridSkeleton, EmptyState, ErrorState, Section } from '../components/States';
import { NewsCard, NewsSkeleton } from '../components/NewsCard';
import { DisciplineTag, EventCard, RaceStrip } from './sport/common';
import { priceLine } from '../components/PriceTag';

function Hero({ car, brands }: { car: CarSummary | undefined; brands: string[] }) {
  const { preferences } = useProfile();
  return (
    <section className="hero" style={{ '--brand-accent': car?.brandAccent } as CSSProperties}>
      <div className="hero-media">
        {car && <CarImage image={car.image} alt={`${car.brandName} ${car.modelName}`} eager large />}
      </div>
      <div className="hero-content">
        <span className="eyebrow">Mon univers</span>
        <h1 className="display">{brands.length ? `${brands.slice(0, 3).join(', ')}${brands.length > 3 ? ` et ${brands.length - 3} autres` : ''}` : 'Toute l’automobile'}</h1>
        <p className="hero-sub">
          {preferences.categories.length
            ? `Vos univers : ${preferences.categories.slice(0, 4).map((c) => CATEGORY_LABELS[c].toLowerCase()).join(', ')}.`
            : 'Un catalogue ouvert à toutes les catégories.'}
        </p>
        {car && (
          <Link to={`/voiture/${car.id}`} className="hero-feature">
            <span className="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>À la une pour vous</span>
            <strong>{car.brandName} {car.modelName} <span style={{ opacity: 0.7, fontWeight: 500 }}>{car.generationName}</span></strong>
            <span className="row gap-2" style={{ fontSize: 'var(--text-sm)' }}>Découvrir la fiche <ArrowRight size={16} /></span>
          </Link>
        )}
      </div>
    </section>
  );
}

export function Home() {
  const { preferences, wishlist } = useProfile();
  const meta = useMeta();
  const forYou = useCars({ pageSize: 40, status: ['on-sale', 'discontinued'] });
  const upcoming = useCars({ status: ['upcoming'], sort: 'release', pageSize: 60, personalize: false });
  const news = useNews({ personal: true, pageSize: 6 });
  const calendar = useSportCalendar();
  const f1 = useF1();

  const followedBrands = Array.isArray(preferences.brands) ? preferences.brands : [];
  const brandNames = followedBrands.map((id) => meta.data?.brands.find((b) => b.id === id)?.name).filter((x): x is string => !!x);

  // « À découvrir » : les meilleures correspondances + quelques modèles hors de vos marques pour élargir l'horizon.
  const discover = useMemo(() => {
    const items = forYou.data?.items ?? [];
    const matches = items.slice(0, 7);
    const others = items.filter((c) => !matches.includes(c) && followedBrands.length && !followedBrands.includes(c.brandId) && c.status !== 'discontinued').slice(0, 3);
    return { matches, others };
  }, [forYou.data, followedBrands]);

  const now = new Date();
  const upcomingItems = upcoming.data?.items ?? [];
  const latest = upcomingItems
    .filter((c) => c.confirmation && ['official-reveal', 'orders-open', 'launch-planned', 'on-sale'].includes(c.confirmation))
    .slice(0, 8);
  const soon = upcomingItems
    // Arrivée sur les routes = livraisons ou disponibilité commerciale, et uniquement si l'information est officielle.
    .filter((c) => c.confirmation && !isUnconfirmed(c.confirmation) && c.confirmation !== 'cancelled'
      && (c.releaseDateKind === 'firstDeliveries' || c.releaseDateKind === 'marketAvailability')
      && c.releaseDate && !['past', 'unknown'].includes(releaseWindow(c.releaseDate, now)))
    .sort((a, b) => partialDateRange(a.releaseDate!).end.getTime() - partialDateRange(b.releaseDate!).end.getTime())
    .slice(0, 6);

  const nextEvents = (['f1', 'wec', 'wrc'] as const)
    .map((d) => calendar.data?.data.find((e) => e.discipline === d && (e.status === 'upcoming' || e.status === 'live')))
    .filter((e): e is NonNullable<typeof e> => !!e);
  const last = f1.data?.data.lastRace;

  return (
    <div className="page-enter">
      <RaceStrip events={nextEvents} />
      <Hero car={discover.matches.find((c) => c.image)} brands={brandNames} />

      <Section title="À découvrir" subtitle="Sélectionné selon vos préférences, avec quelques ouvertures vers d’autres marques." to="/explorer" id="discover">
        {forYou.isLoading ? <CardGridSkeleton rail count={4} /> : forYou.isError ? <ErrorState message="Le catalogue ne répond pas pour le moment." onRetry={() => forYou.refetch()} /> : (
          <div className="rail">
            {discover.matches.map((c, i) => <CarCard key={c.id} car={c} eager={i < 2} />)}
            {discover.others.map((c) => <CarCard key={c.id} car={c} reason="Hors de vos marques — pour élargir l’horizon" />)}
          </div>
        )}
      </Section>

      <Section title="Les dernières nouveautés" subtitle="Modèles présentés officiellement ou dont les commandes sont ouvertes." to="/nouveautes" id="latest">
        {upcoming.isLoading ? <CardGridSkeleton rail count={3} /> : latest.length ? (
          <div className="rail">{latest.map((c) => <CarCard key={c.id} car={c} />)}</div>
        ) : <EmptyState title="Aucune nouveauté confirmée pour l’instant" />}
      </Section>

      <Section title="Bientôt sur nos routes" subtitle="Ordre chronologique, d’après les dates annoncées. Une date connue à l’année près reste affichée à l’année." to="/nouveautes" id="soon">
        {soon.length ? (
          <ol className="timeline">
            {soon.map((c) => {
              const price = priceLine(c, preferences.market);
              return (
                <li key={c.id}>
                  <Link to={`/voiture/${c.id}`} className="timeline-item">
                    <span className="timeline-date num">{formatPartialDate(c.releaseDate)}</span>
                    <span className="timeline-thumb"><CarImage image={c.image} alt="" placeholderLabel="" /></span>
                    <span className="stack" style={{ minWidth: 0 }}>
                      <strong>{c.brandName} {c.modelName}</strong>
                      <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                        {c.releaseDateKind ? MILESTONE_LABELS[c.releaseDateKind] : ''}{c.confirmation ? ` · ${CONFIRMATION_LABELS[c.confirmation]}` : ''}
                      </span>
                    </span>
                    <span className="timeline-price">{price.tone === 'missing' ? 'Prix non annoncé' : price.value}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : !upcoming.isLoading && <EmptyState title="Aucune date de sortie annoncée dans les mois à venir" />}
      </Section>

      <Section title="Ma wishlist" subtitle={wishlist.length ? `${wishlist.length} voiture${wishlist.length > 1 ? 's' : ''} dans votre garage de rêve.` : undefined} to={wishlist.length ? '/wishlist' : undefined} id="wish">
        {wishlist.length ? (
          <div className="rail">{wishlist.slice(0, 8).map((w) => <CarCard key={w.generationId} car={w.snapshot} />)}</div>
        ) : (
          <EmptyState icon={<Heart size={28} />} title="Votre garage de rêve est vide" message="Touchez le cœur sur une carte ou une fiche pour y ajouter une voiture." action={<Link to="/explorer" className="btn btn-sm">Explorer le catalogue</Link>} />
        )}
      </Section>

      <Section title="À la une du sport automobile" to="/sport" id="sport">
        <div className="sport-home">
          {last && (
            <Link to="/sport/f1" className="panel podium-panel">
              <div className="row between"><DisciplineTag d="f1" /><span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>Dernier Grand Prix · manche {last.race.round}</span></div>
              <h3 style={{ marginTop: 'var(--space-3)' }}>{last.race.name}</h3>
              <ol className="podium-list">
                {last.results.slice(0, 3).map((r) => (
                  <li key={r.driver.id}><span className="num pos">{r.position}</span><span>{r.driver.name}</span><span className="subtle">{r.team.name}</span></li>
                ))}
              </ol>
            </Link>
          )}
          {nextEvents.map((e) => <EventCard key={e.id} event={e} />)}
          {calendar.isLoading && <div className="skeleton" style={{ height: 160 }} />}
        </div>
      </Section>

      <Section title="Futures sorties dans l’actualité" subtitle="Annonces et présentations de nouveaux modèles, vos marques en priorité." to="/actualite" id="news">
        {news.isLoading ? <NewsSkeleton count={3} /> : news.isError ? <ErrorState message="Les flux d’actualité ne répondent pas." onRetry={() => news.refetch()} /> : (
          <div className="news-grid">{news.data?.pages[0].data.items.slice(0, 6).map((n) => <NewsCard key={n.id} item={n} compact />)}</div>
        )}
      </Section>
    </div>
  );
}
