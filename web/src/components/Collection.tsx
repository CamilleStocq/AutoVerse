/**
 * « Mon deck » (onglet Deck) : boosters (1 toutes les 3 h), boosters bonus par questionnaire,
 * dossiers par marque (fermés à chaque lancement de l’application). Une carte n'entre dans le deck que si elle sort d'un booster.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, Clock, PackageOpen, Trophy } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { useCards, useMeta } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';
import { MAX_BONUS_PER_INTERVAL, MAX_STORED_BOOSTERS, QUIZ_PER_HOUR, applyCardMigration, cardKey, nextBoosterIn, quizAllowance, useCollection } from '../state/collection';
import type { QuizDiscipline } from '../lib/quiz';
import { TradingCard } from './TradingCard';
import { BoosterOpening } from './BoosterOpening';
import { Quiz } from './Quiz';
import { ErrorState } from './States';

/** Paquet des boosters : les cartes (une par version) des marques préférées, ou toutes si aucune n'est choisie. */
export function useBoosterPool() {
  const { preferences } = useProfile();
  const cars = useCards();
  const favorite = Array.isArray(preferences.brands) ? preferences.brands : [];
  const all = cars.data ?? [];
  const pool = favorite.length ? all.filter((c) => favorite.includes(c.brandId)) : all;
  return { cars, all, pool: pool.length ? pool : all, favorite };
}

/**
 * Dossiers ouverts : gardés en mémoire seulement pendant l'utilisation (navigation entre les pages),
 * jamais enregistrés. À chaque nouvelle ouverture de l'application, tous les dossiers sont fermés.
 */
let sessionOpenFolders = new Set<string>();

/** Emblème de marque : logo sur pastille claire, ou monogramme aux couleurs de la marque. */
function BrandEmblem({ name, logo }: { name: string; logo: string | null }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return <span className="emblem"><img src={logo} alt="" loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" /></span>;
  }
  const initials = name.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className="emblem mono" aria-hidden="true">{initials}</span>;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const duration = (ms: number) => {
  const total = Math.ceil(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};

export function Collection() {
  const { cars, all, pool, favorite } = useBoosterPool();
  const meta = useMeta();
  const { state, owned, doubles, openBooster, commitPending, startQuiz, rewardQuiz } = useCollection();
  const { toast } = useUi();
  const now = useNow(15_000);
  const [opening, setOpening] = useState<{ cards: CarSummary[]; isNew: boolean[] } | null>(null);
  const [quiz, setQuiz] = useState<QuizDiscipline | null>(null);

  const byId = useMemo(() => new Map(all.map((c) => [cardKey(c), c])), [all]);

  const showBooster = (ids: string[]) => {
    const cards = ids.map((id) => byId.get(id)).filter((c): c is CarSummary => !!c);
    if (!cards.length) return;
    // « Nouvelle » = pas encore dans le deck, et première occurrence dans ce booster.
    const isNew = cards.map((c, i) => !owned[cardKey(c)] && cards.findIndex((d) => cardKey(d) === cardKey(c)) === i);
    setOpening({ cards, isNew });
  };

  // Booster ouvert puis interrompu (application fermée) : l'ouverture reprend automatiquement.
  // Ancien deck (une carte par fiche) : converti une fois vers les cartes par version.
  useEffect(() => {
    if (all.length) applyCardMigration(Object.fromEntries(all.filter((c) => c.card?.featured).map((c) => [c.id, cardKey(c)])));
  }, [all]);

  const pendingKey = state.pending?.join(',') ?? '';
  useEffect(() => {
    if (pendingKey && !opening && byId.size) showBooster(pendingKey.split(','));
  }, [pendingKey, byId.size]);

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set(sessionOpenFolders));
  const toggleFolder = (brandId: string) => {
    const next = new Set(openFolders);
    if (next.has(brandId)) next.delete(brandId); else next.add(brandId);
    sessionOpenFolders = next;
    setOpenFolders(next);
  };

  const albums = useMemo(() => {
    const byBrand = new Map<string, CarSummary[]>();
    for (const c of all) byBrand.set(c.brandId, [...(byBrand.get(c.brandId) ?? []), c]);
    const list = [...byBrand.entries()].map(([brandId, cards]) => ({
      brandId,
      name: cards[0].brandName,
      accent: cards[0].brandAccent,
      cards: [...cards].sort((a, b) => (a.card?.number ?? 0) - (b.card?.number ?? 0)),
      owned: cards.filter((c) => owned[cardKey(c)]).length,
      favorite: favorite.includes(brandId),
    }));
    // Mes marques d'abord, puis les albums les plus avancés.
    return list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.owned - a.owned || a.name.localeCompare(b.name));
  }, [all, owned, favorite]);

  const ownedCount = all.filter((c) => owned[cardKey(c)]).length;
  const brandNames = favorite.map((id) => meta.data?.brands.find((b) => b.id === id)?.name).filter(Boolean);
  const packLabel = brandNames.length ? brandNames.slice(0, 3).join(' · ') + (brandNames.length > 3 ? ' …' : '') : 'Toutes les marques';
  const nextIn = nextBoosterIn(state, now);
  const allowance = quizAllowance(state, now);

  const open = () => {
    const ids = openBooster(pool);
    if (ids) showBooster(ids);
  };

  const launchQuiz = (d: QuizDiscipline) => {
    if (startQuiz()) setQuiz(d);
    else toast('Plus de questionnaire disponible pour le moment');
  };

  if (cars.isError) return <ErrorState message="Le catalogue ne répond pas." onRetry={() => cars.refetch()} />;

  return (
    <div className="stack gap-5">
      <section className="collection-hero">
        <div className="stack gap-1">
          <span className="eyebrow">Mon deck</span>
          <strong className="collection-count num">{ownedCount}<small> / {all.length || '…'} cartes</small></strong>
          <div className="collection-bar" aria-hidden="true"><i style={{ width: `${all.length ? (ownedCount / all.length) * 100 : 0}%` }} /></div>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {doubles > 0 ? `${doubles} double${doubles > 1 ? 's' : ''} · ` : ''}Les cartes n’entrent dans votre deck qu’en sortant d’un booster.
          </span>
        </div>
        <button type="button" className="btn btn-primary booster-cta" onClick={state.pending ? () => showBooster(state.pending!) : open} disabled={!state.pending && (state.boosters < 1 || !pool.length)}>
          <PackageOpen size={20} /> {state.pending ? 'Terminer l’ouverture' : 'Ouvrir un booster'}
          {!state.pending && state.boosters > 0 && <span className="booster-count num">{state.boosters}</span>}
        </button>
        <p className="row gap-2 muted" style={{ fontSize: 'var(--text-sm)' }}>
          <Clock size={14} aria-hidden="true" />
          {nextIn == null
            ? `Réserve pleine (${MAX_STORED_BOOSTERS} boosters) : ouvrez-en un pour relancer le compteur.`
            : `Prochain booster gratuit dans ${duration(nextIn)} (1 toutes les 3 heures).`}
        </p>
      </section>

      <section className="panel quiz-panel">
        <h3 className="row gap-2"><Trophy size={18} aria-hidden="true" /> Gagner un booster bonus</h3>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Répondez sans faute à 5 questions sur la F1, le WEC ou le WRC. Jusqu’à {MAX_BONUS_PER_INTERVAL} boosters bonus par période de 3 heures, {QUIZ_PER_HOUR} questionnaires par heure.
        </p>
        <div className="quiz-launch">
          {(['f1', 'wec', 'wrc'] as const).map((d) => (
            <button key={d} type="button" className={`quiz-pick q-${d}`} disabled={allowance.left < 1} onClick={() => launchQuiz(d)}>
              {d.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="subtle num" style={{ fontSize: 'var(--text-xs)' }}>
          {allowance.bonusLeft < 1
            ? `Vos ${MAX_BONUS_PER_INTERVAL} boosters bonus sont gagnés : prochain bonus possible dans ${duration(allowance.waitMs)}.`
            : allowance.attemptsLeft < 1
              ? `${QUIZ_PER_HOUR} questionnaires joués cette heure : prochain dans ${duration(allowance.waitMs)}.`
              : `${allowance.attemptsLeft} questionnaire${allowance.attemptsLeft > 1 ? 's' : ''} disponible${allowance.attemptsLeft > 1 ? 's' : ''} cette heure · ${allowance.bonusLeft} bonus encore possible${allowance.bonusLeft > 1 ? 's' : ''}.`}
        </p>
      </section>

      {cars.isLoading && <div className="skeleton" style={{ height: 300 }} />}

      <section className="stack gap-2" aria-label="Mes dossiers par marque">
        <h2 className="folders-title">Mes dossiers</h2>
        {albums.map((a) => {
          const isOpen = openFolders.has(a.brandId);
          const ownedCards = a.cards.filter((c) => owned[cardKey(c)]);
          const logo = meta.data?.brands.find((b) => b.id === a.brandId)?.logo ?? null;
          return (
            <section key={a.brandId} className={`folder${isOpen ? ' open' : ''}`} style={{ '--brand-accent': a.accent } as CSSProperties}>
              <button type="button" className="folder-head" aria-expanded={isOpen} aria-controls={`dossier-${a.brandId}`} onClick={() => toggleFolder(a.brandId)}>
                <BrandEmblem name={a.name} logo={logo?.src ?? null} />
                <span className="folder-name">{a.name}</span>
                {a.favorite && <span className="badge plain accent">Ma marque</span>}
                <span className="folder-count num">{a.owned} / {a.cards.length}</span>
                <ChevronDown size={20} className="folder-chevron" aria-hidden="true" />
              </button>
              <div className="folder-bar" aria-hidden="true"><i style={{ width: `${(a.owned / a.cards.length) * 100}%` }} /></div>
              {isOpen && (
                <div id={`dossier-${a.brandId}`} className="folder-body">
                  {ownedCards.length ? (
                    <div className="tcard-grid">
                      {ownedCards.map((c) => <TradingCard key={cardKey(c)} car={c} count={owned[cardKey(c)].count} />)}
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>Aucune carte {a.name} pour l’instant : elles arriveront en ouvrant des boosters.</p>
                  )}
                  {logo?.license && <p className="provenance">Logo : {logo.author ? `${logo.author} · ` : ''}{logo.license} (Wikimedia Commons)</p>}
                </div>
              )}
            </section>
          );
        })}
      </section>

      {opening && (
        <BoosterOpening
          cards={opening.cards}
          isNew={opening.isNew}
          packLabel={packLabel}
          onAdd={() => { commitPending(); toast(`${opening.cards.length} cartes ajoutées à votre deck`); }}
          onClose={() => setOpening(null)}
        />
      )}
      {quiz && <Quiz discipline={quiz} onPerfect={rewardQuiz} onClose={() => setQuiz(null)} />}
    </div>
  );
}
