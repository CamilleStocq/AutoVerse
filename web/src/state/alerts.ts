/** Réglages des alertes (sujets suivis, marques) et suivi des alertes déjà vues, par appareil. */
import { useCallback, useEffect, useState } from 'react';
import type { AppEvent, EventTopic } from '@shared/api';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useProfile } from './ProfileProvider';
import { KEYS, readLocal, writeLocal } from './storage';

export interface AlertSettings {
  topics: EventTopic[];
  /** Nouvelles sorties : uniquement les marques suivies (onboarding / profil). */
  myBrandsOnly: boolean;
  lastSeen: string | null;
}

export const ALL_TOPICS: Array<{ id: EventTopic; label: string; description: string }> = [
  { id: 'releases', label: 'Nouvelles dates de sortie', description: 'Nouveau modèle annoncé, date de présentation, de commandes, de livraison ou de commercialisation, report ou annulation.' },
  { id: 'f1', label: 'Résultats Formule 1', description: 'Podium et classement dès la publication des résultats officiels du Grand Prix.' },
  { id: 'wec', label: 'Résultats WEC', description: 'Podiums par catégorie (Hypercar, LMGT3) après chaque manche.' },
  { id: 'wrc', label: 'Résultats WRC', description: 'Podium de chaque rallye.' },
];

const DEFAULTS: AlertSettings = { topics: ['releases', 'f1', 'wec', 'wrc'], myBrandsOnly: false, lastSeen: null };
const listeners = new Set<(s: AlertSettings) => void>();

export function useAlertSettings() {
  const [settings, setState] = useState<AlertSettings>(() => ({ ...DEFAULTS, ...readLocal<Partial<AlertSettings>>(KEYS.alerts, {}) }));
  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  const update = useCallback((patch: Partial<AlertSettings>) => {
    const next = { ...DEFAULTS, ...readLocal<Partial<AlertSettings>>(KEYS.alerts, {}), ...patch };
    writeLocal(KEYS.alerts, next);
    listeners.forEach((l) => l(next));
  }, []);
  return { settings, update };
}

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<{ updatedAt: string | null; events: AppEvent[] }>('/events'),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}

/** Alertes correspondant aux sujets (et éventuellement aux marques) choisis. */
export function useMyEvents() {
  const q = useEvents();
  const { settings } = useAlertSettings();
  const { preferences } = useProfile();
  const brands = Array.isArray(preferences.brands) ? preferences.brands : [];
  const events = (q.data?.events ?? []).filter((e) => settings.topics.includes(e.topic)
    && (e.topic !== 'releases' || !settings.myBrandsOnly || !brands.length || (e.brandId != null && brands.includes(e.brandId))));
  const unread = events.filter((e) => !settings.lastSeen || e.createdAt > settings.lastSeen).length;
  return { ...q, events, unread, brands };
}
