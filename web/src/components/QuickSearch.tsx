/**
 * Recherche globale (Ctrl+K, « / » ou icône loupe) : accès direct à une fiche ou à une rubrique,
 * entièrement pilotable au clavier.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { useCars } from '../hooks/queries';
import { CarImage } from './CarImage';

const PAGES = [
  { label: 'Accueil', to: '/', keywords: 'accueil home univers' },
  { label: 'Rechercher un modèle', to: '/explorer', keywords: 'explorer recherche catalogue voitures' },
  { label: 'Nouveautés et sorties à venir', to: '/nouveautes', keywords: 'nouveautes sorties futures prochaines calendrier' },
  { label: 'Ma wishlist', to: '/wishlist', keywords: 'wishlist favoris garage coeur' },
  { label: 'Comparateur', to: '/comparer', keywords: 'comparer comparateur face' },
  { label: 'Actualité automobile', to: '/actualite', keywords: 'actualite news articles' },
  { label: 'Calendrier sport auto', to: '/sport', keywords: 'sport calendrier courses' },
  { label: 'Formule 1', to: '/sport/f1', keywords: 'f1 formule 1 grand prix classement pilotes' },
  { label: 'WEC — Endurance', to: '/sport/wec', keywords: 'wec endurance le mans hypercar' },
  { label: 'WRC — Rallye', to: '/sport/wrc', keywords: 'wrc rallye rally' },
  { label: 'Profil et paramètres', to: '/profil', keywords: 'profil parametres preferences marche theme' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useQuickSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export function QuickSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim());
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const cars = useCars({ q: dq, pageSize: 7, personalize: false }, dq.length > 0);

  const pages = useMemo(() => {
    const t = norm(dq);
    return t ? PAGES.filter((p) => norm(`${p.label} ${p.keywords}`).includes(t)).slice(0, 4) : PAGES.slice(0, 6);
  }, [dq]);
  const carItems = dq ? cars.data?.items ?? [] : [];
  const results = [
    ...carItems.map((c) => ({ key: c.id, to: `/voiture/${c.id}`, car: c })),
    ...pages.map((p) => ({ key: p.to, to: p.to, page: p })),
  ];

  useEffect(() => { setActive(0); }, [dq, carItems.length]);
  useEffect(() => {
    inputRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);

  const go = (to: string) => { onClose(); navigate(to); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active].to); }
    else if (e.key === 'Tab') e.preventDefault(); // focus maintenu dans la recherche
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="qs" role="dialog" aria-modal="true" aria-label="Recherche rapide" onKeyDown={onKey}>
        <label className="qs-field">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">Rechercher une voiture ou une rubrique</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Voiture, marque ou rubrique…"
            role="combobox"
            aria-expanded="true"
            aria-controls="qs-list"
            aria-activedescendant={results[active] ? `qs-${active}` : undefined}
          />
          <kbd>Échap</kbd>
        </label>
        <ul id="qs-list" role="listbox" className="qs-list">
          {dq && !!carItems.length && <li className="qs-group" role="presentation">Voitures</li>}
          {results.map((r, i) => (
            <li key={r.key} id={`qs-${i}`} role="option" aria-selected={i === active}>
              {i === carItems.length && <div className="qs-group">{dq ? 'Rubriques' : 'Aller à'}</div>}
              <button type="button" className="qs-item" onMouseEnter={() => setActive(i)} onClick={() => go(r.to)} tabIndex={-1}>
                {'car' in r && r.car ? (
                  <>
                    <span className="qs-thumb"><CarImage image={r.car.image} alt="" placeholderLabel="" /></span>
                    <span className="stack" style={{ minWidth: 0 }}>
                      <strong>{r.car.brandName} {r.car.modelName}</strong>
                      <span className="subtle" style={{ fontSize: 12 }}>{r.car.generationName} · {r.car.yearsLabel}</span>
                    </span>
                  </>
                ) : (
                  <><ArrowRight size={16} aria-hidden="true" /><span>{'page' in r ? r.page!.label : ''}</span></>
                )}
                {i === active && <CornerDownLeft size={14} className="qs-enter" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {dq && cars.isFetching && !carItems.length && <li className="qs-empty">Recherche…</li>}
          {dq && !cars.isFetching && !results.length && <li className="qs-empty">Aucun résultat pour « {dq} ».</li>}
        </ul>
        <p className="qs-hint"><kbd>↑</kbd><kbd>↓</kbd> naviguer · <kbd>Entrée</kbd> ouvrir · <kbd>Ctrl</kbd>+<kbd>K</kbd> ou <kbd>/</kbd> depuis n’importe où</p>
      </div>
    </>
  );
}
