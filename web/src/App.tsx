import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileProvider, useProfile } from './state/ProfileProvider';
import { UiProvider } from './state/UiProvider';
import { AppShell } from './components/AppShell';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { CardGridSkeleton } from './components/States';

const Explore = lazy(() => import('./pages/Explore').then((m) => ({ default: m.Explore })));
const CarDetailPage = lazy(() => import('./pages/CarDetail').then((m) => ({ default: m.CarDetailPage })));
const Upcoming = lazy(() => import('./pages/Upcoming').then((m) => ({ default: m.Upcoming })));
const Wishlist = lazy(() => import('./pages/Wishlist').then((m) => ({ default: m.Wishlist })));
const Compare = lazy(() => import('./pages/Compare').then((m) => ({ default: m.Compare })));
const News = lazy(() => import('./pages/News').then((m) => ({ default: m.News })));
const Sport = lazy(() => import('./pages/Sport').then((m) => ({ default: m.Sport })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Première ouverture : l'accueil redirige vers le questionnaire (les liens directs restent accessibles). */
function HomeGate() {
  const { isOnboarded } = useProfile();
  return isOnboarded ? <Home /> : <Navigate to="/bienvenue" replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="main"><CardGridSkeleton count={3} /></div>}>
      <Routes>
        <Route path="/bienvenue" element={<Onboarding />} />
        <Route path="/profil/preferences" element={<Onboarding editing />} />
        <Route element={<AppShell />}>
          <Route index element={<HomeGate />} />
          <Route path="explorer" element={<Explore />} />
          <Route path="voiture/:id" element={<CarDetailPage />} />
          <Route path="nouveautes" element={<Upcoming />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="comparer" element={<Compare />} />
          <Route path="actualite" element={<News />} />
          <Route path="sport/*" element={<Sport />} />
          <Route path="profil" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <UiProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppRoutes />
          </BrowserRouter>
        </UiProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}
