/**
 * Flux d'actualité utilisés. Uniquement des flux RSS publics publiés par les éditeurs
 * pour la syndication : on affiche titre, court extrait, image fournie par le flux et
 * lien vers l'article original (jamais le contenu complet).
 * Sources primaires (constructeurs) en premier : elles sont prioritaires lors du dédoublonnage.
 */
export interface FeedSource {
  id: string;
  name: string;
  url: string;
  homepage: string;
  type: 'manufacturer' | 'press';
  lang: 'fr' | 'en';
  /** Marques implicites (flux d'un constructeur). */
  brands?: string[];
  /** Rubrique : automobile ou une discipline sportive. */
  scope: 'auto' | 'f1' | 'wec' | 'wrc';
}

export const FEEDS: FeedSource[] = [
  // Constructeurs (communiqués officiels)
  { id: 'bmw-group', name: 'BMW Group PressClub', url: 'https://www.press.bmwgroup.com/global/rss', homepage: 'https://www.press.bmwgroup.com', type: 'manufacturer', lang: 'en', scope: 'auto' },
  { id: 'toyota-eu', name: 'Toyota Europe Newsroom', url: 'https://newsroom.toyota.eu/feed/', homepage: 'https://newsroom.toyota.eu', type: 'manufacturer', lang: 'en', brands: ['toyota'], scope: 'auto' },
  // Presse automobile reconnue
  { id: 'moniteur', name: 'Moniteur Automobile', url: 'https://www.moniteurautomobile.be/rss/actu.xml', homepage: 'https://www.moniteurautomobile.be', type: 'press', lang: 'fr', scope: 'auto' },
  { id: 'motor1-fr', name: 'Motor1 France', url: 'https://fr.motor1.com/rss/news/all/', homepage: 'https://fr.motor1.com', type: 'press', lang: 'fr', scope: 'auto' },
  { id: 'autoplus', name: 'Auto Plus', url: 'https://www.autoplus.fr/feed', homepage: 'https://www.autoplus.fr', type: 'press', lang: 'fr', scope: 'auto' },
  { id: 'automobile-propre', name: 'Automobile Propre', url: 'https://www.automobile-propre.com/feed/', homepage: 'https://www.automobile-propre.com', type: 'press', lang: 'fr', scope: 'auto' },
  { id: 'carscoops', name: 'Carscoops', url: 'https://www.carscoops.com/feed/', homepage: 'https://www.carscoops.com', type: 'press', lang: 'en', scope: 'auto' },
  { id: 'insideevs', name: 'InsideEVs', url: 'https://insideevs.com/rss/news/all/', homepage: 'https://insideevs.com', type: 'press', lang: 'en', scope: 'auto' },
  // Sport automobile
  { id: 'f1-official', name: 'Formula1.com', url: 'https://www.formula1.com/en/latest/all.xml', homepage: 'https://www.formula1.com', type: 'manufacturer', lang: 'en', scope: 'f1' },
  { id: 'motorsport-f1', name: 'Motorsport.com France — F1', url: 'https://fr.motorsport.com/rss/f1/news/', homepage: 'https://fr.motorsport.com/f1/', type: 'press', lang: 'fr', scope: 'f1' },
  { id: 'motorsport-wec', name: 'Motorsport.com France — WEC', url: 'https://fr.motorsport.com/rss/wec/news/', homepage: 'https://fr.motorsport.com/wec/', type: 'press', lang: 'fr', scope: 'wec' },
  { id: 'motorsport-wrc', name: 'Motorsport.com France — WRC', url: 'https://fr.motorsport.com/rss/wrc/news/', homepage: 'https://fr.motorsport.com/wrc/', type: 'press', lang: 'fr', scope: 'wrc' },
];
