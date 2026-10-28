/**
 * Page Badges (icône médaille en haut) : le seul endroit où les badges apparaissent.
 * Chaque badge montre sa progression et ce qu'il reste à faire avant de l'obtenir.
 */
import { useEffect } from 'react';
import { Check, Crown, Gift, Flag, Gem, Layers, Mountain, Package, Timer, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { remainingText, useBadges, type BadgeIcon } from '../lib/badges';
import { BOOSTERS_PER_BADGE } from '../state/collection';
import { ErrorState } from '../components/States';

const ICONS: Record<BadgeIcon, LucideIcon> = { cards: Layers, crown: Crown, gem: Gem, flag: Flag, mountain: Mountain, zap: Zap, clock: Timer, package: Package, trophy: Trophy };

export function Badges() {
  const { badges, unseen, loading, error, retry, markBadges } = useBadges();
  const unlocked = badges.filter((b) => b.unlocked);
  const unseenIds = unseen.map((b) => b.id);

  // Les badges nouvellement débloqués sont signalés ici une fois, puis considérés comme vus.
  useEffect(() => {
    if (unseenIds.length) {
      const t = setTimeout(() => markBadges(unseenIds), 1500);
      return () => clearTimeout(t);
    }
  }, [unseenIds.join(',')]);

  // Les plus proches d'être obtenus d'abord, les badges obtenus à la fin.
  const sorted = [...badges].sort((a, b) => Number(a.unlocked) - Number(b.unlocked) || b.have / b.goal - a.have / a.goal);

  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Collection</span>
        <h1>Mes badges</h1>
        <p>{loading ? 'Chargement…' : `${unlocked.length} badge${unlocked.length > 1 ? 's' : ''} obtenu${unlocked.length > 1 ? 's' : ''} sur ${badges.length}.`} Ils se débloquent en complétant votre deck, et chacun rapporte {BOOSTERS_PER_BADGE} boosters.</p>
      </header>
      {error ? <ErrorState message="Le catalogue ne répond pas." onRetry={retry} /> : loading ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : (
        <ul className="badge-list">
          {sorted.map((b) => {
            const Icon = ICONS[b.icon];
            const pct = Math.round((b.have / b.goal) * 100);
            return (
              <li key={b.id} className={`badge-row${b.unlocked ? ' unlocked' : ''}`}>
                <span className="badge-icon" aria-hidden="true"><Icon size={22} /></span>
                <div className="badge-body">
                  <div className="badge-title">
                    <strong>{b.label}</strong>
                    {unseenIds.includes(b.id) && <span className="badge plain accent">Nouveau</span>}
                  </div>
                  <span className="badge-desc">{b.description}</span>
                  <span className="badge-reward"><Gift size={13} aria-hidden="true" /> {b.unlocked ? `${BOOSTERS_PER_BADGE} boosters reçus` : `Récompense : ${BOOSTERS_PER_BADGE} boosters`}</span>
                  <div className="badge-progress" role="progressbar" aria-valuemin={0} aria-valuemax={b.goal} aria-valuenow={b.have} aria-label={b.label}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div className="badge-meta num">
                    <span>{b.have} / {b.goal}</span>
                    {b.unlocked
                      ? <span className="badge-state"><Check size={12} aria-hidden="true" /> Obtenu</span>
                      : <span>{remainingText(b)} · {pct} %</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
