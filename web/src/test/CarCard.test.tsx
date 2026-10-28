import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CarSummary, PriceView } from '@shared/api';
import { ProfileProvider } from '../state/ProfileProvider';
import { UiProvider } from '../state/UiProvider';
import { CarCard } from '../components/CarCard';
import { priceLine } from '../components/PriceTag';

const source = { label: 'Constructeur', url: 'https://ex.com', type: 'manufacturer' as const, retrievedAt: '2026-10-28' };
const pv = (over: Partial<PriceView>): PriceView => ({ amount: 50000, currency: 'EUR', market: 'BE', type: 'range-start', asOf: '2026-09-01', variantName: 'Base', source, ...over });

const car: CarSummary = {
  id: 'porsche-911-992-2', brandId: 'porsche', brandName: 'Porsche', brandAccent: '#b12b28', modelId: 'porsche-911', modelName: '911',
  generationName: '992.2', yearsLabel: '2024 –', startYear: 2024, status: 'on-sale', confirmation: null,
  categories: ['sports', 'coupe'], powertrains: ['petrol'], segment: 'S', bodyStyles: ['Coupé'], priceRange: 'luxury', image: null,
  keyFact: { label: 'Puissance', value: '394 ch' }, maxPowerHp: 394, startingPrice: pv({ amount: 135660 }), otherMarketPrice: null,
  estimatedPrice: null, releaseDate: null, releaseDateKind: null, isUpcoming: false, variantCount: 2, updatedAt: '2026-10-28',
};

function renderCard(c: CarSummary) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileProvider>
        <UiProvider>
          <MemoryRouter><CarCard car={c} /></MemoryRouter>
        </UiProvider>
      </ProfileProvider>
    </QueryClientProvider>,
  );
}

describe('priceLine', () => {
  it('privilégie le prix vérifié du marché choisi', () => {
    expect(priceLine({ startingPrice: pv({}), estimatedPrice: null, otherMarketPrice: null }, 'BE').value).toMatch(/^dès 50/);
  });
  it('nomme le marché quand le prix vient d’un autre pays', () => {
    const l = priceLine({ startingPrice: null, estimatedPrice: null, otherMarketPrice: pv({ market: 'FR', type: 'variant' }) }, 'BE');
    expect(l.label).toContain('France');
    expect(l.tone).toBe('other-market');
  });
  it('présente une estimation comme telle, jamais comme officielle', () => {
    const l = priceLine({ startingPrice: null, otherMarketPrice: null, estimatedPrice: pv({ type: 'estimate', estimate: { low: 60000, high: 70000, confidence: 'low' } }) }, 'BE');
    expect(l.label).toBe('Estimation presse');
    expect(l.tone).toBe('estimate');
  });
  it('indique clairement un prix non communiqué', () => {
    expect(priceLine({ startingPrice: null, estimatedPrice: null, otherMarketPrice: null }, 'BE').value).toBe('Non communiqué (Belgique)');
  });
});

describe('CarCard', () => {
  beforeEach(() => {
    localStorage.clear();
    // Serveur indisponible : l'application doit rester utilisable et garder les favoris en local.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
  });

  it('affiche marque, modèle, information clé et prix contextualisé', () => {
    renderCard(car);
    expect(screen.getByRole('link', { name: '911' })).toHaveAttribute('href', '/voiture/porsche-911-992-2');
    expect(screen.getByText('394 ch')).toBeInTheDocument();
    expect(screen.getByText('Prix de départ')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /photo non disponible/i })).toBeInTheDocument();
  });

  it('le cœur bascule immédiatement et le favori survit au rechargement (hors ligne)', async () => {
    const { unmount } = renderCard(car);
    const heart = screen.getByRole('button', { name: /Ajouter à la wishlist/ });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(heart);
    expect(screen.getByRole('button', { name: /Retirer de la wishlist/ })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(JSON.parse(localStorage.getItem('autoverse.wishlist')!)[0].generationId).toBe(car.id));
    // L'opération est mise en file pour être synchronisée au retour du réseau.
    await waitFor(() => expect(JSON.parse(localStorage.getItem('autoverse.pendingSync')!).length).toBeGreaterThan(0));
    unmount();
    renderCard(car);
    expect(screen.getByRole('button', { name: /Retirer de la wishlist/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('affiche l’étape réellement datée pour une nouveauté', () => {
    renderCard({ ...car, id: 'x', isUpcoming: true, confirmation: 'official-reveal', status: 'announced', releaseDate: { year: 2027 }, releaseDateKind: 'presentation' });
    expect(screen.getByText(/Présentation : 2027/)).toBeInTheDocument();
    expect(screen.getByText('Présentation officielle')).toBeInTheDocument();
  });
});
