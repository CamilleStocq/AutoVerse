import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import type { CategoryId, Powertrain, PriceRange } from '@shared/types';
import type { Interest, Period, Preferences, Usage } from '@shared/profile';
import {
  CATEGORY_LABELS, INTEREST_LABELS, MARKETS, PERIOD_LABELS, POWERTRAIN_LABELS, PRICE_RANGE_LABELS, USAGE_LABELS,
} from '@shared/labels';
import { useMeta, useCars } from '../hooks/queries';
import { useProfile } from '../state/ProfileProvider';
import { Logo } from '../components/AppShell';
import { KEYS, readLocal, removeLocal, writeLocal } from '../state/storage';
import { CarImage } from '../components/CarImage';

const STEPS = ['Marques', 'Catégories', 'Préférences', 'Région'] as const;

/** Catégories proposées à l'étape 2, dans l'ordre de l'énoncé. */
const CATEGORY_ORDER: CategoryId[] = [
  'sports', 'supercar', 'sport-sedan', 'coupe', 'convertible', 'city', 'compact', 'family-sedan', 'wagon',
  'suv', 'sport-suv', 'luxury', 'gt', 'ev', 'phev', 'hybrid', 'ice', 'offroad', 'classic',
];

const FLAGS: Record<string, string> = { BE: '🇧🇪', FR: '🇫🇷', LU: '🇱🇺', NL: '🇳🇱', DE: '🇩🇪', CH: '🇨🇭', IT: '🇮🇹', ES: '🇪🇸', GB: '🇬🇧' };

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function ChipGroup<T extends string>({ label, options, value, onChange, noneLabel }: {
  label: string; options: Record<T, string>; value: T[]; onChange: (v: T[]) => void; noneLabel?: string;
}) {
  return (
    <fieldset className="ob-fieldset">
      <legend className="label">{label}</legend>
      <div className="chip-row">
        {noneLabel && (
          <button type="button" className="chip" aria-pressed={value.length === 0} onClick={() => onChange([])}>{noneLabel}</button>
        )}
        {(Object.keys(options) as T[]).map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={value.includes(k)} onClick={() => onChange(toggle(value, k))}>
            {value.includes(k) && <Check size={14} />} {options[k]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Onboarding({ editing }: { editing?: boolean }) {
  const { preferences, savePreferences } = useProfile();
  const navigate = useNavigate();
  // Questionnaire en cours conservé si l'application est fermée avant la fin (première ouverture).
  const saved = editing ? null : readLocal<{ step: number; draft: Preferences } | null>(KEYS.onboardingDraft, null);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [draft, setDraft] = useState<Preferences>(saved?.draft ?? preferences);
  const [query, setQuery] = useState('');
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);
  useLayoutEffect(() => {
    if (!editing) writeLocal(KEYS.onboardingDraft, { step, draft });
  }, [editing, step, draft]);
  const meta = useMeta();
  // Une vraie photo du catalogue illustre chaque catégorie (aucune image générique).
  const sample = useCars({ pageSize: 100, personalize: false, sort: 'newest' });

  const categoryImages = useMemo(() => {
    const map = new Map<CategoryId, NonNullable<(typeof sample.data)>['items'][number]>();
    for (const c of CATEGORY_ORDER) {
      const car = sample.data?.items.find((x) => x.image && x.categories.includes(c) && ![...map.values()].some((m) => m.id === x.id))
        ?? sample.data?.items.find((x) => x.image && x.categories.includes(c));
      if (car) map.set(c, car);
    }
    return map;
  }, [sample.data]);

  const brands = useMemo(() => {
    const list = meta.data?.brands ?? [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((b) => b.name.toLowerCase().includes(q)) : list;
  }, [meta.data, query]);

  const selectedBrands = Array.isArray(draft.brands) ? draft.brands : [];
  const allBrands = draft.brands === 'all';

  const finish = () => {
    savePreferences(draft, { completeOnboarding: true });
    removeLocal(KEYS.onboardingDraft);
    navigate(editing ? '/profil' : '/', { replace: true });
  };
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <div className="onboarding">
      <header className="ob-head">
        <div className="brandmark" style={{ padding: 0 }}><Logo /> Autoverse</div>
        <ol className="ob-progress" aria-label="Étapes">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : undefined}>
              <span className="num">{i + 1}</span><span className="ob-step-label">{s}</span>
            </li>
          ))}
        </ol>
        {editing
          ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/profil')}>Annuler</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={finish}>Explorer sans personnaliser</button>}
      </header>

      <main className="ob-main page-enter" key={step}>
        {step === 0 && (
          <>
            <div className="ob-intro">
              <span className="eyebrow">Étape 1 sur 4</span>
              <h1 className="display">Quelles marques vous font vibrer&nbsp;?</h1>
              <p className="muted">Sélectionnez autant de marques que vous le souhaitez. Elles orienteront votre catalogue, votre fil d'actualité et vos recommandations — sans jamais vous empêcher d'explorer les autres.</p>
            </div>
            <div className="ob-toolbar">
              <label className="search" style={{ flex: 1, maxWidth: 420 }}>
                <span className="sr-only">Rechercher une marque</span>
                <Search size={18} />
                <input className="input" type="search" placeholder="Porsche, Alpine…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <button type="button" className="chip" aria-pressed={allBrands} onClick={() => setDraft({ ...draft, brands: allBrands ? [] : 'all' })}>
                {allBrands && <Check size={14} />} Toutes les marques
              </button>
              {selectedBrands.length > 0 && <span className="muted num" style={{ fontSize: 'var(--text-sm)' }}>{selectedBrands.length} sélectionnée{selectedBrands.length > 1 ? 's' : ''}</span>}
            </div>
            <div className="brand-grid" role="group" aria-label="Marques">
              {brands.map((b) => {
                const on = allBrands || selectedBrands.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="brand-tile"
                    aria-pressed={on}
                    style={{ '--brand-accent': b.accent } as CSSProperties}
                    onClick={() => setDraft({ ...draft, brands: toggle(allBrands ? [] : selectedBrands, b.id) })}
                  >
                    <span className="brand-tile-name">{b.name}</span>
                    <span className="brand-tile-meta">{b.country}{b.carCount ? ` · ${b.carCount} fiche${b.carCount > 1 ? 's' : ''}` : ''}</span>
                    <span className="brand-tile-check" aria-hidden="true"><Check size={14} /></span>
                  </button>
                );
              })}
              {meta.isLoading && Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--radius-md)' }} />)}
            </div>
            {!brands.length && !meta.isLoading && <p className="muted">Aucune marque ne correspond à « {query} ».</p>}
          </>
        )}

        {step === 1 && (
          <>
            <div className="ob-intro">
              <span className="eyebrow">Étape 2 sur 4</span>
              <h1 className="display">Vos styles de voitures</h1>
              <p className="muted">Les catégories se cumulent : une même voiture peut être à la fois coupé, sportive et hybride rechargeable. La classification provient des fiches, jamais du nom du modèle.</p>
            </div>
            <div className="cat-grid" role="group" aria-label="Catégories">
              {CATEGORY_ORDER.map((c) => {
                const on = draft.categories.includes(c);
                const car = categoryImages.get(c);
                return (
                  <button key={c} type="button" className="cat-tile" aria-pressed={on} onClick={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })}>
                    <div className="cat-media">
                      <CarImage image={car?.image ?? null} alt="" placeholderLabel="" />
                    </div>
                    <span className="cat-name">{CATEGORY_LABELS[c]}</span>
                    {car && <span className="cat-example">ex. {car.brandName} {car.modelName}</span>}
                    <span className="brand-tile-check" aria-hidden="true"><Check size={14} /></span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-intro">
              <span className="eyebrow">Étape 3 sur 4 · facultative</span>
              <h1 className="display">Affinez, si vous le souhaitez</h1>
              <p className="muted">Aucun de ces choix ne bloque l'accès à l'application. Vous pourrez tout modifier plus tard dans votre profil.</p>
            </div>
            <div className="stack gap-5">
              <ChipGroup<Powertrain> label="Motorisation" options={POWERTRAIN_LABELS} value={draft.powertrains} onChange={(v) => setDraft({ ...draft, powertrains: v })} noneLabel="Sans préférence" />
              <ChipGroup<PriceRange> label="Gamme de prix" options={PRICE_RANGE_LABELS} value={draft.priceRanges} onChange={(v) => setDraft({ ...draft, priceRanges: v })} noneLabel="Sans préférence" />
              <ChipGroup<Period> label="Période" options={PERIOD_LABELS} value={draft.periods} onChange={(v) => setDraft({ ...draft, periods: v })} noneLabel="Toutes générations" />
              <ChipGroup<Usage> label="Usage" options={USAGE_LABELS} value={draft.usages} onChange={(v) => setDraft({ ...draft, usages: v })} />
              <ChipGroup<Interest> label="Ce qui vous passionne" options={INTEREST_LABELS} value={draft.interests} onChange={(v) => setDraft({ ...draft, interests: v })} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-intro">
              <span className="eyebrow">Étape 4 sur 4</span>
              <h1 className="display">Votre marché</h1>
              <p className="muted">Il détermine les prix affichés (devise et TVA locales), les dates de commercialisation et la disponibilité. Un prix estimé n'est jamais présenté comme officiel.</p>
            </div>
            <div className="market-grid" role="radiogroup" aria-label="Marché">
              {MARKETS.map((m) => (
                <button key={m.code} type="button" role="radio" aria-checked={draft.market === m.code} className="market-tile" onClick={() => setDraft({ ...draft, market: m.code })}>
                  <span className="market-flag" aria-hidden="true">{FLAGS[m.code]}</span>
                  <span className="stack">
                    <strong>{m.name}</strong>
                    <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Prix en {m.currency === 'EUR' ? 'euros' : m.currency === 'CHF' ? 'francs suisses' : 'livres sterling'}</span>
                  </span>
                  <span className="brand-tile-check" aria-hidden="true"><Check size={14} /></span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="ob-foot">
        <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft size={18} /> Retour</button>
        <div className="row gap-2">
          {step < STEPS.length - 1 && (
            <button type="button" className="btn btn-ghost" onClick={next}>Passer cette étape</button>
          )}
          <button type="button" className="btn btn-primary" onClick={next}>
            {step === STEPS.length - 1 ? (editing ? 'Enregistrer mes préférences' : 'Découvrir mon univers') : 'Continuer'} <ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
