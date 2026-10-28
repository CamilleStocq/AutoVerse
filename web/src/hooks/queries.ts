import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CarDetail, CarSummary, CatalogMeta, NewsItem, Paged, SourcedPayload, SportEvent } from '@shared/api';
import type { F1Overview, F1RoundDetail, WecSeason, WrcSeason } from '@shared/sport';
import type { Preferences } from '@shared/profile';
import { api } from '../lib/api';
import { useProfile } from '../state/ProfileProvider';

export interface CarFilters {
  q?: string;
  brands?: string[];
  categories?: string[];
  powertrains?: string[];
  priceRanges?: string[];
  status?: string[];
  yearFrom?: number | null;
  yearTo?: number | null;
  ids?: string[];
  sort?: string;
  pageSize?: number;
  personalize?: boolean;
}

/** Préférences en paramètres courts : elles orientent l'ordre, sans filtrer. */
export function prefsParams(p: Preferences) {
  return {
    pb: Array.isArray(p.brands) ? p.brands : [],
    pc: p.categories,
    pp: p.powertrains,
    pr: p.priceRanges,
    pu: p.usages,
    pper: p.periods,
  };
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<CatalogMeta>('/meta'), staleTime: 5 * 60_000 });
}

function carParams(f: CarFilters, prefs: Preferences) {
  return {
    q: f.q, brands: f.brands, categories: f.categories, powertrains: f.powertrains, priceRanges: f.priceRanges,
    status: f.status, yearFrom: f.yearFrom ?? undefined, yearTo: f.yearTo ?? undefined, ids: f.ids,
    sort: f.sort, market: prefs.market, pageSize: f.pageSize ?? 24,
    ...(f.personalize === false ? {} : prefsParams(prefs)),
  };
}

export function useCars(filters: CarFilters, enabled = true) {
  const { preferences } = useProfile();
  const params = carParams(filters, preferences);
  return useQuery({
    queryKey: ['cars', params],
    queryFn: () => api.get<Paged<CarSummary>>('/cars', params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Catalogue paginé à chargement progressif (« Voir plus »). */
export function useInfiniteCars(filters: CarFilters) {
  const { preferences } = useProfile();
  const params = carParams(filters, preferences);
  return useInfiniteQuery({
    queryKey: ['cars-infinite', params],
    queryFn: ({ pageParam }) => api.get<Paged<CarSummary>>('/cars', { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useCar(id: string | undefined) {
  const { preferences } = useProfile();
  return useQuery({
    queryKey: ['car', id, preferences.market],
    queryFn: () => api.get<CarDetail>(`/cars/${encodeURIComponent(id!)}`, { market: preferences.market }),
    enabled: !!id,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });
}

type NewsPayload = SourcedPayload<Paged<NewsItem>> & { feeds: Array<{ id: string; name: string; ok: boolean; stale: boolean; fetchedAt: string | null }> };

export function useNews(params: { scope?: 'auto' | 'f1' | 'wec' | 'wrc'; brands?: string[]; categories?: string[]; q?: string; personal?: boolean; pageSize?: number }) {
  const { preferences } = useProfile();
  const query = {
    scope: params.scope ?? 'auto',
    brands: params.brands,
    categories: params.categories,
    q: params.q,
    personal: params.personal ? '1' : undefined,
    pb: params.personal && Array.isArray(preferences.brands) ? preferences.brands : undefined,
    pageSize: params.pageSize ?? 20,
  };
  return useInfiniteQuery({
    queryKey: ['news', query],
    queryFn: ({ pageParam }) => api.get<NewsPayload>('/news', { ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.data.page * last.data.pageSize < last.data.total ? last.data.page + 1 : undefined),
    staleTime: 5 * 60_000,
    refetchInterval: 20 * 60_000,
  });
}

export function useF1() {
  return useQuery({
    queryKey: ['f1'],
    queryFn: () => api.get<SourcedPayload<F1Overview>>('/sport/f1'),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}

export function useF1Round(season: number | undefined, round: number | null) {
  return useQuery({
    queryKey: ['f1-round', season, round],
    queryFn: () => api.get<SourcedPayload<F1RoundDetail>>(`/sport/f1/${season}/${round}`),
    enabled: !!season && !!round,
    staleTime: 10 * 60_000,
  });
}

export function useSeries<T extends 'wec' | 'wrc'>(series: T) {
  return useQuery({
    queryKey: ['series', series],
    queryFn: () => api.get<SourcedPayload<T extends 'wec' ? WecSeason : WrcSeason>>(`/sport/${series}`),
    staleTime: 30 * 60_000,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });
}

export function useSportCalendar() {
  return useQuery({
    queryKey: ['sport-calendar'],
    queryFn: () => api.get<SourcedPayload<SportEvent[]>>('/sport/calendar'),
    staleTime: 15 * 60_000,
  });
}
