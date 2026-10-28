/**
 * « Mon deck » (onglet Deck) : boosters de 7 cartes (1 toutes les 2 h, jamais de double), boosters bonus par questionnaire,
 * dossiers par marque (fermés à chaque lancement de l’application). Une carte n'entre dans le deck que si elle sort d'un booster.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Clock, Crown, Flag, Gem, Layers, Mountain, Package, PackageOpen, Timer, Trophy, Zap, type LucideIcon } from 'lucide-react';
import type { CarSummary } from '@shared/api';
import { useCards, useMeta } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';
import { BOOSTER_INTERVAL_HOURS, MAX_BONUS_PER_INTERVAL, MAX_STORED_BOOSTERS, QUIZ_PER_HOUR, applyCardMigration, cardKey, nextBoosterIn, quizAllowance, useCollection } from '../state/collection';
import type { QuizDiscipline } from '../lib/quiz';
import { computeBadges, type BadgeIcon } from '../lib/badges';
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
/** Filtre des dossiers (« Mes cartes » ou « Manquantes »), lui aussi remis à zéro à chaque lancement. */
let sessionFolderFilter: 'owned' | 'missing' = 'owned';

const BADGE_ICONS: Record<BadgeIcon, LucideIcon> = { cards: Layers, crown: Crown, gem: Gem, flag: Flag, mountain: Mountain, zap: Zap, clock: Timer, package: Package, trophy: Trophy };

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
  const { state, owned, markBadges, openBooster, commitPending, startQuiz, rewardQuiz } = useCollection();
  const { toast } = useUi();
  const now = useNow(15_000);
  const [opening, setOpening] = useState<{ cards: CarSummary[]; isNew: boolean[] } | null>(null);
  const [quiz, setQuiz] = useState<QuizDiscipline | null>(null);

  const byId = useMemo(() => new Map(all.map((c) => [cardKey(c), c])), [all]);
  const [filter, setFilterState] = useState(sessionFolderFilter);
  const setFilter = (f: 'owned' | 'missing') => { sessionFolderFilter = f; setFilterState(f); };

  const badges = useMemo(() => computeBadges(all, owned, state.opened), [all, owned, state.opened]);
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  // Nouveau badge débloqué : annoncé une seule fois (pas pendant l'ouverture d'un booster).
  const unlockedKey = badges.filter((b) => b.unlocked).map((b) => b.id).join(',');
  useEffect(() => {
    if (!all.length || opening || !unlockedKey) return;
    const fresh = markBadges(unlockedKey.split(','));
    const first = badges.find((b) => b.id === fresh[0]);
    if (first) toast(fresh.length > 1 ? `${fresh.length} badges débloqués, dont « ${first.label} »` : `Badge débloqué : « ${first.label} »`);
  }, [unlockedKey, opening, all.length]);

  const showBooster = (ids: string[]) => {
    const cards = ids.map((id) => byId.get(id)).filter((c): c is CarSummary => !!c);
    if (!cards.length) return;
    // « Nouvelle » = pas encore dans le deck, et première occurrence dans ce booster.
    const isNew = cards.map(() => true);
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
    const ids = openBooster(pool, all);
    if (ids) showBooster(ids);
    else if (state.boosters > 0) toast('Collection complète : vous avez toutes les cartes !');
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
            Les cartes n’entrent dans votre deck qu’en sortant d’un booster, et jamais en double.
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
            : `Prochain booster gratuit dans ${duration(nextIn)} (1 toutes les ${BOOSTER_INTERVAL_HOURS} heures).`}
        </p>
      </section>

      <section className="panel quiz-panel">
        <h3 className="row gap-2"><Trophy size={18} aria-hidden="true" /> Gagner un booster bonus</h3>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Répondez sans faute à 5 questions sur la F1, le WEC ou le WRC. Jusqu’à {MAX_BONUS_PER_INTERVAL} boosters bonus par période de {BOOSTER_INTERVAL_HOURS} heures, {QUIZ_PER_HOUR} questionnaires par heure.
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

      {all.length > 0 && (
        <section className="stack gap-3" aria-label="Mes badges">
          <h2 className="folders-title">Mes badges <span className="num muted">{unlockedCount} / {badges.length}</span></h2>
          <div className="badge-grid">
            {badges.map((b) => {
              const Icon = BADGE_ICONS[b.icon];
              return (
                <div key={b.id} className={`badge-tile${b.unlocked ? ' unlocked' : ''}`} title={b.description}>
                  <span className="badge-icon" aria-hidden="true"><Icon size={20} /></span>
                  <strong>{b.label}</strong>
                  <span className="badge-desc">{b.description}</span>
                  {b.unlocked
                    ? <span className="badge-state"><Check size={12} aria-hidden="true" /> Débloqué</span>
                    : <span className="badge-progress num" aria-label={`${b.have} sur ${b.goal}`}><i style={{ width: `${(b.have / b.goal) * 100}%` }} /><em>{b.have} / {b.goal}</em></span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="stack gap-2" aria-label="Mes dossiers par marque">
        <div className="folders-head">
          <h2 className="folders-title">Mes dossiers</h2>
          <div className="segmented" role="group" aria-label="Cartes affichées">
            <button type="button" aria-pressed={filter === 'owned'} onClick={() => setFilter('owned')}>Mes cartes</button>
            <button type="button" aria-pressed={filter === 'missing'} onClick={() => setFilter('missing')}>Manquantes</button>
          </div>
        </div>
        {filter === 'missing' && albums.length > 0 && albums.every((a) => a.owned === a.cards.length) && (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>Aucune carte manquante : votre collection est complète.</p>
        )}
        {albums.filter((a) => filter === 'owned' || a.owned < a.cards.length).map((a) => {
          const isOpen = openFolders.has(a.brandId);
          const ownedCards = a.cards.filter((c) => owned[cardKey(c)]);
          const missingCards = a.cards.filter((c) => !owned[cardKey(c)]);
          const complete = a.owned === a.cards.length;
          const logo = meta.data?.brands.find((b) => b.id === a.brandId)?.logo ?? null;
          return (
            <section key={a.brandId} className={`folder${isOpen ? ' open' : ''}`} style={{ '--brand-accent': a.accent } as CSSProperties}>
              <button type="button" className="folder-head" aria-expanded={isOpen} aria-controls={`dossier-${a.brandId}`} onClick={() => toggleFolder(a.brandId)}>
                <BrandEmblem name={a.name} logo={logo?.src ?? null} />
                <span className="folder-name">{a.name}</span>
                {complete ? <span className="badge plain positive">Complet</span> : a.favorite && <span className="badge plain accent">Ma marque</span>}
                <span className="folder-count num">{filter === 'missing' ? `${missingCards.length} manquante${missingCards.length > 1 ? 's' : ''}` : `${a.owned} / ${a.cards.length}`}</span>
                <ChevronDown size={20} className="folder-chevron" aria-hidden="true" />
              </button>
              <div className="folder-bar" aria-hidden="true"><i style={{ width: `${(a.owned / a.cards.length) * 100}%` }} /></div>
              {isOpen && (
                <div id={`dossier-${a.brandId}`} className="folder-body">
                  {filter === 'missing' ? (
                    <div className="tcard-grid">
                      {missingCards.map((c) => <TradingCard key={cardKey(c)} car={c} locked />)}
                    </div>
                  ) : ownedCards.length ? (
                    <div className="tcard-grid">
                      {ownedCards.map((c) => <TradingCard key={cardKey(c)} car={c} />)}
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
          onAdd={() => { commitPending(); toast(`${opening.cards.length} nouvelle${opening.cards.length > 1 ? 's' : ''} carte${opening.cards.length > 1 ? 's' : ''} dans votre deck`); }}
          onClose={() => setOpening(null)}
        />
      )}
      {quiz && <Quiz discipline={quiz} onPerfect={rewardQuiz} onClose={() => setQuiz(null)} />}
    </div>
  );
}
