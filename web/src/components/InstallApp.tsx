/**
 * Installation de l'application sur l'écran d'accueil (PWA), sans store :
 * bouton natif sur Android / Chrome / Edge, instructions pas à pas sur iPhone et iPad (Safari).
 */
import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstallState() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIos(),
    prompt: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      listeners.forEach((l) => l());
      return outcome === 'accepted';
    },
  };
}

export function InstallPanel() {
  const s = useInstallState();
  return (
    <section className="panel">
      <h3>Installer l’application</h3>
      {s.installed ? (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>Autoverse est installée sur cet appareil.</p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            Ajoutez Autoverse à votre écran d’accueil : elle s’ouvre en plein écran comme une application, sans passer par un store, et reste consultable hors ligne.
          </p>
          {s.canPrompt && (
            <button type="button" className="btn btn-primary btn-sm" onClick={s.prompt}><Download size={16} /> Installer Autoverse</button>
          )}
          {!s.canPrompt && s.ios && (
            <ol className="bullet-list" style={{ fontSize: 'var(--text-sm)' }}>
              <li>Dans Safari, touchez <Share size={14} style={{ verticalAlign: '-2px' }} aria-label="Partager" /> <strong>Partager</strong>.</li>
              <li>Choisissez <SquarePlus size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
            </ol>
          )}
          {!s.canPrompt && !s.ios && (
            <p className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
              Sur Android : menu ⋮ du navigateur → <strong>Installer l’application</strong> (ou « Ajouter à l’écran d’accueil »). Sur ordinateur : icône d’installation dans la barre d’adresse de Chrome ou Edge.
            </p>
          )}
        </>
      )}
    </section>
  );
}
