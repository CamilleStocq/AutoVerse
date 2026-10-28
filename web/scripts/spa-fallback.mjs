/**
 * GitHub Pages ne connaît pas les routes de l'application (/deck, /badges…) : sans ce fichier,
 * ouvrir une de ces adresses directement (ou rouvrir l'app sur la dernière page) donne une erreur 404.
 * Pages sert 404.html pour toute adresse inconnue : c'est une copie de index.html, l'app démarre
 * donc normalement et affiche la bonne page.
 */
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
copyFileSync(`${dist}index.html`, `${dist}404.html`);
console.log('404.html créé (repli des routes de l’application)');
