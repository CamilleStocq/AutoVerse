/** État d'interface transverse : sélection du comparateur, thème, notifications brèves. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CarSummary } from '@shared/api';
import { KEYS, readLocal, writeLocal } from './storage';

export const COMPARE_MAX = 4;
export type Theme = 'dark' | 'light' | 'system';

interface UiContextValue {
  compare: CarSummary[];
  isCompared: (id: string) => boolean;
  toggleCompare: (car: CarSummary) => void;
  setCompare: (cars: CarSummary[]) => void;
  clearCompare: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toast: (message: string) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [compare, setCompareState] = useState<CarSummary[]>(() => readLocal(KEYS.compare, []));
  const [theme, setThemeState] = useState<Theme>(() => readLocal(KEYS.theme, 'dark'));
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);

  useEffect(() => writeLocal(KEYS.compare, compare), [compare]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeLocal(KEYS.theme, theme);
  }, [theme]);

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const toggleCompare = useCallback((car: CarSummary) => {
    setCompareState((list) => {
      if (list.some((c) => c.id === car.id)) return list.filter((c) => c.id !== car.id);
      if (list.length >= COMPARE_MAX) {
        toast(`Le comparateur accepte ${COMPARE_MAX} voitures au maximum`);
        return list;
      }
      return [...list, car];
    });
  }, [toast]);

  const value = useMemo<UiContextValue>(() => ({
    compare,
    isCompared: (id) => compare.some((c) => c.id === id),
    toggleCompare,
    setCompare: (cars) => setCompareState(cars.slice(0, COMPARE_MAX)),
    clearCompare: () => setCompareState([]),
    theme,
    setTheme: setThemeState,
    toast,
  }), [compare, toggleCompare, theme, toast]);

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="toast-zone" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast">{t.message}</div>)}
      </div>
    </UiContext.Provider>
  );
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi doit être utilisé dans <UiProvider>');
  return ctx;
}
