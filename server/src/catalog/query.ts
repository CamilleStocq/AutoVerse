/** Requêtes catalogue côté API : adaptateurs vers le moteur partagé (shared/catalog-engine.ts). */
import type { Generation, MarketCode } from '../../../shared/types.ts';
import * as engine from '../../../shared/catalog-engine.ts';
import { catalogContext } from './store.ts';

export type { CarQuery } from '../../../shared/catalog-engine.ts';
export { preferenceScore } from '../../../shared/catalog-engine.ts';

export const queryCars = (query: engine.CarQuery) => engine.queryCars(catalogContext(), query);
export const similarCars = (target: Generation, market: MarketCode, limit?: number) => engine.similarCars(catalogContext(), target, market, limit);
export const carDetail = (id: string, market: MarketCode) => engine.carDetail(catalogContext(), id, market);
export const collectibleCards = (market: MarketCode) => engine.collectibleCards(catalogContext(), market);
export const catalogMeta = () => engine.catalogMeta(catalogContext());
