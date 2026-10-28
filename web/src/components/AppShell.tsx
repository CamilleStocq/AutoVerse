import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarClock, Download, Flag, Heart, Home, Layers, Medal, Newspaper, Search, Settings, X } from 'lucide-react';
import { useInstallState } from './InstallApp';
import { useMyEvents } from '../state/alerts';
import { useTableLabels } from '../hooks/useTableLabels';
import { QuickSearch, useQuickSearchShortcut } from './QuickSearch';
import { useCollection } from '../state/collection';
import { useBadges } from '../lib/badges';
import { useProfile } from '../state/ProfileProvider';
import { useUi } from '../state/UiProvider';

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="10" fill="var(--surface)" />
      <path d="M30 4h20a10 10 0 0 1 10 10v16" fill="none" stroke="var(--accent)" strokeWidth="3.2" />
      <path d="M12 52 29 14h8l17 38h-9L33 25 21 52Z" fill="var(--accent)" />
      <rect x="23" y="40" width="20" height="5" fill="var(--text)" />
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/explorer', label: 'Recherche', icon: Search },
  { to: '/deck', label: 'Deck', icon: Layers },
  { to: '/nouveautes', label: 'Nouveautés', icon: CalendarClock },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/actualite', label: 'Actualité', icon: Newspaper },
  { to: '/alertes', label: 'Alertes', icon: Bell },
  { to: '/sport', label: 'Sport auto', icon: Flag },
  { to: '/profil', label: 'Profil et paramètres', icon: Settings },
];

/** Navigation mobile (une main) : 6 rubriques principales ; Actualité et Profil en haut. */
const BOTTOM = ['/', '/explorer', '/deck', '/nouveautes', '/wishlist', '/sport'];

function CompareTray() {
  const { compare, clearCompare } = useUi();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const visible = compare.length > 0 && !pathname.startsWith('/comparer');
  // Signale la présence du bandeau à la mise en page (mobile : l'espace lui est réservé, rien n'est recouvert).
  useEffect(() => {
    document.body.classList.toggle('has-tray', visible);
    return () => document.body.classList.remove('has-tray');
  }, [visible]);
  if (!visible) return null;
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
  // Badge du Deck : boosters de cartes prêts à ouvrir.
  const { state: collection } = useCollection();
  const boosters = collection.boosters;
  // Point sur la médaille : un badge obtenu n'a pas encore été vu sur la page Badges.
  const { badges, unseen, rewardBadges } = useBadges();
  const newBadges = unseen.length;
  // Chaque badge obtenu rapporte 1 à 3 boosters selon sa difficulté, une seule fois.
  const unlockedKey = badges.filter((b) => b.unlocked).map((b) => b.id).join(',');
  useEffect(() => { if (unlockedKey) rewardBadges(badges.filter((b) => b.unlocked)); }, [unlockedKey]);
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const install = useInstallState();
  const { unread } = useMyEvents();
  useTableLabels();
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
                  {to === '/deck' && boosters > 0 && <span className="count num unread" title="Boosters à ouvrir">{boosters}</span>}
                  {to === '/alertes' && unread > 0 && <span className="count num unread">{unread}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {install.canPrompt && !install.installed && (
          <button type="button" className="btn btn-sm" style={{ marginTop: 'auto' }} onClick={install.prompt}><Download size={16} /> Installer l’app</button>
        )}
        <p className="sidebar-foot" style={install.canPrompt && !install.installed ? { marginTop: 0 } : undefined}>Données sourcées et datées. Photos : Wikimedia Commons (licences libres).</p>
      </aside>

      <div className="content-wrap">
        <header className="topbar">
          <Link to="/" className="brandmark" style={{ padding: 0 }}><Logo /> Autoverse</Link>
          <div className="topbar-actions">
            {install.canPrompt && !install.installed && (
              <button type="button" className="icon-btn" onClick={install.prompt} aria-label="Installer l’application" data-tip="Installer"><Download size={20} /></button>
            )}
            <NavLink to="/badges" className="icon-btn" aria-label={newBadges ? `Badges (${newBadges} nouveau${newBadges > 1 ? 'x' : ''})` : 'Badges'} data-tip="Badges"><Medal size={20} />{newBadges > 0 && <span className="dot num">{newBadges > 9 ? '9+' : newBadges}</span>}</NavLink>
            <NavLink to="/alertes" className="icon-btn" aria-label={unread ? `Alertes (${unread} non lues)` : 'Alertes'} data-tip="Alertes"><Bell size={20} />{unread > 0 && <span className="dot num">{unread > 9 ? '9+' : unread}</span>}</NavLink>
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
              {((to === '/wishlist' && wishlist.length > 0) || (to === '/deck' && boosters > 0)) && (
                <span className="num" style={{ position: 'absolute', top: -4, right: -10, fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 8, padding: '0 4px', lineHeight: '14px' }} aria-label={to === '/deck' ? boosters + ' boosters à ouvrir' : wishlist.length + ' favoris'}>{to === '/deck' ? boosters : wishlist.length}</span>
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
