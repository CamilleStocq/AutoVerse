import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';

export function NotFound() {
  return (
    <EmptyState
      title="Cette page n’existe pas"
      message="Le lien est peut-être incomplet ou la page a été déplacée."
      action={<Link to="/" className="btn btn-sm">Retour à l’accueil</Link>}
    />
  );
}
