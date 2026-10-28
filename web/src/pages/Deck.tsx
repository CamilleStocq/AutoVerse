import { Collection } from '../components/Collection';

/** Onglet « Deck » : boosters, questionnaires bonus et dossiers de cartes par marque. */
export function Deck() {
  return (
    <div className="page-enter">
      <header className="page-head">
        <span className="eyebrow">Collection</span>
        <h1>Mon deck</h1>
        <p>Ouvrez des boosters de vos marques préférées et rangez vos cartes dans leurs dossiers. Une carte n’entre dans votre deck qu’en sortant d’un booster.</p>
      </header>
      <Collection />
    </div>
  );
}
