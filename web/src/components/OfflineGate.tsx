/**
 * Sans connexion internet, l'application n'affiche aucune donnée (pas de catalogue, d'actualité
 * ou de résultats potentiellement périmés) : un écran explique la situation et l'app reprend
 * d'elle-même dès que la connexion revient. Les cartes et préférences restent sur l'appareil.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Logo } from './AppShell';

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function OfflineGate({ children }: { children: ReactNode }) {
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <main className="offline-screen" role="alert">
      <span className="offline-logo"><Logo /></span>
      <WifiOff size={36} aria-hidden="true" />
      <h1>Pas de connexion internet</h1>
      <p>Autoverse n’affiche que des données à jour : reconnectez-vous pour voir le catalogue, vos cartes et les résultats. Votre collection et vos préférences restent enregistrées sur cet appareil.</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}><RefreshCw size={18} /> Réessayer</button>
    </main>
  );
}
