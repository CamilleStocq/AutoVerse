import { useEffect } from 'react';

/**
 * Sur mobile, chaque ligne de tableau s'affiche comme une petite fiche (voir mobile.css) :
 * on recopie l'intitulé de chaque colonne dans `data-label` sur ses cellules, pour tous les
 * tableaux `.data-table` présents ou ajoutés plus tard dans la page.
 */
export function useTableLabels() {
  useEffect(() => {
    const label = (table: HTMLTableElement) => {
      const heads = [...(table.tHead?.rows[0]?.cells ?? [])].map((th) => th.textContent?.trim() ?? '');
      if (!heads.length) return;
      for (const body of table.tBodies) {
        for (const row of body.rows) {
          [...row.cells].forEach((cell, i) => {
            const text = heads[i];
            if (text && cell.dataset.label !== text) cell.dataset.label = text;
          });
        }
      }
    };
    const scan = () => document.querySelectorAll<HTMLTableElement>('table.data-table').forEach(label);
    scan();
    // setTimeout plutôt que requestAnimationFrame : ce dernier est suspendu quand l'app est en arrière-plan.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
}
