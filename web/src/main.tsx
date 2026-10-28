import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/titillium-web/400.css';
import '@fontsource/titillium-web/600.css';
import '@fontsource/titillium-web/700.css';
import '@fontsource/titillium-web/900.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/search.css';
import './styles/cards.css';
import './styles/booster.css';
import './styles/mobile.css';
import { App } from './App';

// Thème appliqué avant le premier rendu pour éviter un flash.
try {
  const t = JSON.parse(localStorage.getItem('autoverse.theme') ?? '"dark"');
  document.documentElement.dataset.theme = t;
} catch {
  document.documentElement.dataset.theme = 'dark';
}

// Écran figé comme une application : Safari iOS ignore « user-scalable=no », on bloque donc
// ses gestes de zoom ; sur ordinateur, le pincement du pavé tactile arrive en Ctrl+molette.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// Application installable et hors ligne (version publiée uniquement).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then((reg) => {
      // Sur iPhone, l'app ajoutée à l'écran d'accueil reprend souvent sans se recharger :
      // on cherche une nouvelle version à chaque retour au premier plan, et on l'applique
      // au retour suivant (jamais en pleine utilisation).
      const hadController = !!navigator.serviceWorker.controller;
      let updated = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) updated = true; });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (updated) window.location.reload();
        else reg.update().catch(() => {});
      });
    }).catch(() => {
      // Sans service worker l'application fonctionne normalement, simplement sans mode hors ligne.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
