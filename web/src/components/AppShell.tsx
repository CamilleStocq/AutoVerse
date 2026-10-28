import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Compass, Flag, Heart, Home, Newspaper, Search, Settings, X } from 'lucide-react';
import { QuickSearch, useQuickSearchShortcut } from './QuickSearch';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--surface-3)" />
      <path d="M14 44 L30 18 L36 18 L50 44 L43 44 L33 26 L23 44 Z" fill="var(--accent)" />
      <rect x="24" y="36" width="16" height="4" rx="1" fill="var(--text)" />
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/explorer', label: 'Explorer', icon: Compass },
  { to: '/nouveautes', label: 'Nouveautés', icon: CalendarClock },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/actualite', label: 'Actualité', icon: Newspaper },
  { to: '/sport', label: 'Sport auto', icon: Flag },
  { to: '/profil', label: 'Profil et paramètres', icon: Settings },
];

/** Navigation mobile (une main) : 5 rubriques principales ; Actualité et Profil en haut. */
const BOTTOM = ['/', '/explorer', '/nouveautes', '/wishlist', '/sport'];

function CompareTray() {
  const { compare, clearCompare } = useUi();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!compare.length || pathname.startsWith('/comparer')) return null;
  return (
    <div className="compare-tray" role="region" aria-label="Sélection du comparateur">
      <div className="thumbs" aria-hidden="true">
        {compare.map((c) => (c.image ? <img key={c.id} src={c.image.thumb} alt="" /> : <span key={c.id} />))}
      </div>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{compare.length} sélectionnée{compare.length > 1 ? 's' : ''}</span>
      <button type="button" className="btn btn-primary btn-sm" disabled={compare.length < 2} onClick={() => navigate(`/comparer?ids=${compare.map((c) => c.id).join(',')}`)}>
        {compare.length < 2 ? 'Ajoutez une 2e voiture' : 'Comparer'}
      </button>
      <button type="button" className="icon-btn" onClick={clearCompare} aria-label="Vider le comparateur" data-tip="Vider"><X size={18} /></button>
    </div>
  );
}

export function AppShell() {
  const { wishlist } = useProfile();
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useQuickSearchShortcut(openSearch);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return (
    <div className="shell">
      <a href="#contenu" className="sr-only">Aller au contenu</a>
      <aside className="sidebar" aria-label="Navigation principale">
        <Link to="/" className="brandmark"><Logo /> Autoverse</Link>
        <button type="button" className="search-trigger" onClick={openSearch}>
          <Search size={16} aria-hidden="true" /> Rechercher <kbd>Ctrl K</kbd>
        </button>
        <nav>
          <ul className="navlist">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="navlink">
                  <Icon size={20} strokeWidth={1.8} />
                  {label}
                  {to === '/wishlist' && wishlist.length > 0 && <span className="count num">{wishlist.length}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="sidebar-foot">Données sourcées et datées. Photos : Wikimedia Commons (licences libres).</p>
      </aside>

      <div className="content-wrap">
        <header className="topbar">
          <Link to="/" className="brandmark" style={{ padding: 0 }}><Logo /> Autoverse</Link>
          <div className="topbar-actions">
            <button type="button" className="icon-btn" onClick={openSearch} aria-label="Rechercher" data-tip="Rechercher"><Search size={20} /></button>
            <NavLink to="/actualite" className="icon-btn" aria-label="Actualité" data-tip="Actualité"><Newspaper size={20} /></NavLink>
            <NavLink to="/profil" className="icon-btn" aria-label="Profil et paramètres" data-tip="Profil"><Settings size={20} /></NavLink>
          </div>
        </header>
        <main id="contenu" className="main">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav" aria-label="Navigation principale">
        {NAV.filter((n) => BOTTOM.includes(n.to)).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <span style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={1.8} />
              {to === '/wishlist' && wishlist.length > 0 && (
                <span className="num" style={{ position: 'absolute', top: -4, right: -10, fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 8, padding: '0 4px', lineHeight: '14px' }}>{wishlist.length}</span>
              )}
            </span>
            {label === 'Sport auto' ? 'Sport' : label}
          </NavLink>
        ))}
      </nav>
      <CompareTray />
      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
