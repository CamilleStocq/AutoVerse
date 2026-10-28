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
import { App } from './App';

// Thème appliqué avant le premier rendu pour éviter un flash.
try {
  const t = JSON.parse(localStorage.getItem('autoverse.theme') ?? '"dark"');
  document.documentElement.dataset.theme = t;
} catch {
  document.documentElement.dataset.theme = 'dark';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
