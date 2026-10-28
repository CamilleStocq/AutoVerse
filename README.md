# Autoverse

Magazine automobile personnel : catalogue personnalisé, fiches détaillées, nouveautés datées, wishlist, comparateur, actualité, et sport automobile (F1, WEC, WRC).

## Utiliser l'application (rien à installer)

**https://camillestocq.github.io/AutoVerse/**

Elle s'ouvre dans n'importe quel navigateur, sur téléphone comme sur ordinateur. Pour l'avoir comme une application, en plein écran, avec son icône et utilisable hors ligne :
- **Android, Chrome ou Edge sur ordinateur :** bouton *Installer l'app*, ou menu du navigateur → *Installer l'application*.
- **iPhone, iPad :** dans Safari, *Partager* → *Sur l'écran d'accueil*.

Fonctionnement de la version en ligne (GitHub Pages, sans serveur) :
- Le workflow `.github/workflows/pages.yml` régénère les données toutes les 30 minutes : actualité, F1, calendrier, photos. GitHub peut décaler ces exécutions de quelques minutes.
- Le catalogue, la recherche et la personnalisation tournent dans le navigateur, avec le même moteur que l'API (`shared/catalog-engine.ts`).
- Préférences et favoris sont enregistrés sur l'appareil. Pour changer d'appareil : *Profil → Exporter mes données*, puis *Importer une sauvegarde* sur l'autre appareil. La synchronisation automatique n'existe qu'avec le serveur Node (voir plus bas).

**Activation, une seule fois :** dans le dépôt GitHub, *Settings → Pages → Build and deployment → Source* : choisir **GitHub Actions**.

### Application mobile

- **Écran figé :** pas de zoom (pincement, double-tap, zoom automatique des champs sur iPhone) et aucun glissement latéral : seul le défilement vertical est possible.
- **Rien n'est masqué sur mobile, tout est réorganisé :**
  - rangées de cartes en liste verticale de cartes compactes ;
  - puces et onglets qui passent à la ligne ;
  - tableaux en fiches, chaque valeur avec son intitulé ;
  - comparateur caractéristique par caractéristique.
- **Sauvegarde sur l'appareil, écrite immédiatement :** préférences, favoris, collection de cartes, sujets d'alertes, comparateur, thème, vue choisie, questionnaire en cours. Une sauvegarde de secours est faite quand l'app passe en arrière-plan. Le navigateur est aussi prié de ne jamais effacer ces données.

### Cartes à collectionner (Explorer et Deck)

- **Une carte par version** (ex. 911 Carrera, 911 Carrera GTS) : stats et prix de cette seule version ; une fiche sans version publiée donne une seule carte. Les decks enregistrés avec l'ancien format (une carte par fiche) sont convertis automatiquement, doubles compris.
- **Recherche :** aucune carte n'est affichée tant qu'on ne cherche rien ; un modèle recherché montre sa carte et sa fiche. Des raccourcis (Hypercars ≥ 900 ch, Supercars, Endurance, Rallye, Légendes, Électriques) permettent d'explorer sans savoir quoi taper.
- **Hors ligne :** aucune donnée n'est affichée sans connexion (les données ne sont jamais mises en cache) ; un écran l'explique et l'app reprend dès le retour du réseau. La collection reste sur l'appareil.

- **Catalogue :** chaque voiture est une carte à collectionner (format 63 × 88). Elle porte :
  - la puissance en « PV » et la rareté ;
  - les stats de la version la plus puissante : 0 à 100 km/h, vitesse maximale, couple ou autonomie, prix ;
  - un texte d'ambiance tiré de la fiche ;
  - un numéro dans la série de la marque (`shared/catalog-engine.ts` › `rarityOf`, `brandSet`).
- **Rareté, règle explicite et stable :**
  - Légendaire : icône de collection ou ≥ 900 ch ;
  - Épique : supercar, luxe ou ≥ 600 ch ;
  - Rare : premium, sportive, SUV sportif, GT ou ≥ 300 ch ;
  - Commune : le reste.

  Les cartes Épiques et Légendaires ont un reflet holographique.
- **Onglet Deck** (barre du bas) : tout ce qui concerne les cartes.
  - **Boosters :** 3 boosters de bienvenue, puis 1 booster gratuit toutes les 2 heures (jusqu'à 3 en réserve). Chaque booster contient 7 cartes, toutes différentes et **jamais déjà possédées** (aucun double), tirées parmi vos marques préférées puis dans tout le catalogue quand elles sont complètes ; au moins une Rare quand il en reste.
  - **Badges :** page dédiée (icône médaille en haut, seul endroit où ils apparaissent) : 17 badges (10, 50, 100, 250, 500 cartes, collection complète, Légendaires, séries Endurance, Rallye, Supercars, Légendes, marques complètes, boosters ouverts), avec pour chacun la progression et ce qu'il reste avant de l'obtenir. Un point sur la médaille signale un badge obtenu pas encore vu.
  - **Filtre « Manquantes » :** les dossiers montrent soit vos cartes, soit les emplacements des cartes qui vous manquent.
  - **Ouverture animée :** le booster fermé arrive en grand, on glisse pour le déchirer, les cartes sortent, on les fait défiler une à une, puis elles s'affichent côte à côte avec le bouton « Ajouter au deck ». Un booster interrompu (app fermée) reprend à la réouverture.
  - **Questionnaires F1, WEC, WRC :** 5 questions générées à partir des vraies données (classements, calendriers, engagés). Un sans-faute rapporte un booster bonus. Au plus 3 questionnaires par heure et 2 boosters bonus par période de 2 heures.
  - **Dossiers par marque :** logo (Wikimedia Commons via Wikidata, auteur et licence indiqués ; monogramme aux couleurs de la marque si aucun logo fiable) + nom + progression. Un appui ouvre le dossier et montre les cartes obtenues, un nouvel appui le referme. Tous les dossiers sont fermés à chaque lancement de l'app.
  - **Recherche :** l'onglet Explorer montre la carte et la fiche de n'importe quelle voiture, mais une carte n'entre dans le deck qu'en sortant d'un booster (`web/src/state/collection.ts`).
- La collection fait partie de la sauvegarde exportable (*Profil → Exporter mes données*).

> Sur iPhone, Safari et l'application ajoutée à l'écran d'accueil ont des stockages séparés : utilisez toujours l'icône de l'écran d'accueil.

### Alertes et notifications

À chaque mise à jour, l'export compare les nouvelles données à la version en ligne (`server/src/events.ts`). Il en tire des alertes :
- **Sorties :** nouveau modèle à venir ; date de présentation, de commandes, de production, de livraison ou de commercialisation annoncée ou modifiée ; report ; annulation.
- **Sport :** résultats d'un nouveau Grand Prix de F1 ; podiums WEC par catégorie et podiums WRC dès leur intégration.

Les alertes s'affichent dans la page **Alertes** de l'app. Elles sont aussi envoyées en **notification push** (même app fermée) une fois le registre d'abonnements configuré : voir [`push-worker/README.md`](push-worker/README.md), une seule fois et 10 minutes.

### Actualité

La rubrique est recentrée sur les **futures sorties de modèles** : annonces, présentations, prochaines générations, dates de commercialisation. Elle comprend aussi l'actualité **F1, WEC et WRC**. L'actualité automobile générale (essais, trafic, carburant, aides…) est filtrée (`isLaunchNews`).

## Développement local

Prérequis : **Node.js ≥ 22.18** (testé avec Node 24). Aucune base de données à installer : SQLite est intégré à Node.

```bash
npm install
npm run dev          # API sur :8787 + frontend sur http://localhost:5173
```

Production (un seul processus, l'API sert aussi le frontend compilé) :

```bash
npm run build
npm start            # http://localhost:8787
```

Autres commandes : `npm test` (serveur + web), `npm run typecheck`.

## Architecture

```
shared/   Types, libellés FR, dates partielles — partagés par l'API et le frontend
server/   API Node + TypeScript (exécuté nativement par Node, sans étape de build)
  src/catalog/   chargement/validation des fiches, images Commons, recherche, similarité
  src/news/      agrégation RSS, classification, dédoublonnage
  src/sport/     F1 (API Jolpica), WEC/WRC (instantané sourcé), calendrier unifié
  src/routes/    catalogue, contenus, profil & wishlist
  data/seed/     données compilées et sourcées (JSON)
web/      React 19 + Vite + TanStack Query + React Router
```

**Choix techniques**
- **Node + Hono** : API légère. Le serveur est le seul à appeler les sources externes : aucune clé dans le client, cache et limitation des requêtes centralisés.
- **SQLite intégré (`node:sqlite`)** : persistance des profils, favoris et du cache, sans service externe.
- **Cache « stale-if-error »** : si une source tombe, la dernière copie est servie avec un avertissement. L'application reste utilisable.
- **React + TanStack Query** : navigation sans rechargement, mise en cache côté client, pagination progressive.
- **Pas de bibliothèque d'UI** : design system maison d'inspiration « paddock » : tokens CSS, thèmes sombre et clair, Titillium Web auto-hébergée, angles vifs, rouge signal, filet en coin de carte. Aucun logo ni marque de la F1 n'est utilisé.
- **Efficacité** : recherche globale `Ctrl+K` ou `/` (voitures et rubriques, entièrement au clavier) ; vue cartes ou liste compacte dans Explorer, choix mémorisé ; barre de recherche et de filtres collante ; filtres dans l'URL, donc partageables ; bandeau des prochaines épreuves avec compte à rebours sur l'accueil.

## Données : sources, limites, fiabilité

| Domaine | Source | Mise à jour | Limites |
|---|---|---|---|
| Fiches, versions, prix | `server/data/seed/catalog-*.json`, compilées depuis les sites et communiqués constructeurs et la presse reconnue | Manuelle (fichiers JSON, rechargés à chaud) | Aucune API gratuite ne couvre specs + prix européens. Chaque valeur cite sa source et sa date de consultation ; les champs inconnus restent vides |
| Nouveautés | `server/data/seed/upcoming.json` (niveau de confirmation, jalons distincts, sources datées) | Manuelle | Instantané au 28/10/2026, à actualiser au fil des annonces |
| Photos | Wikimedia Commons (API) : auteur et licence affichés | Cache 30 jours | Couverture variable ; visuel neutre sinon, jamais la photo d'un autre modèle |
| Actualité | RSS publics : BMW Group PressClub, Toyota Europe Newsroom, Moniteur Automobile, Motor1 FR, Auto Plus, Automobile Propre, Carscoops, InsideEVs | Cache 20 min | Titre, court extrait et lien vers l'original uniquement. Doublons regroupés (même langue) |
| Formule 1 | API Jolpica-F1 (successeur d'Ergast) : calendrier, résultats, qualifications, sprints, classements | 15 min à 6 h selon la donnée | Publié après chaque séance, pas de chronométrage en direct : aucun « live » affiché |
| WEC / WRC | `server/data/seed/motorsport-2026.json`, compilé depuis fiawec.com, wrc.com et la presse | Manuelle | Il n'existe pas d'API officielle ouverte (Al Kamel et wrc.com ne sont ni documentés ni licenciés). Les statuts sont recalculés selon la date ; un podium n'est affiché que s'il figure dans l'instantané |
| Actualité sportive | RSS Formula1.com + Motorsport.com France (F1, WEC, WRC) | Cache 20 min | Les informations rapportées par la presse ne sont pas des annonces officielles |

API étudiées et écartées : **TheSportsDB** (la clé gratuite tronque les saisons à 15 événements et ne fournit pas les classements WEC/WRC), **OpenF1** (le temps réel est payant), **CarQuery** et **NHTSA vPIC** (données américaines, sans prix européens ni specs WLTP), **API Ninjas Cars** et **Auto-Data** (payantes, couverture européenne partielle).

**Mettre à jour les données** : modifiez ou ajoutez un fichier `server/data/seed/catalog-*.json` en respectant `shared/types.ts`. L'API le revalide et le recharge à chaud. Une fiche invalide est écartée et signalée dans `/api/health`, sans bloquer les autres.

## Règles métier appliquées dans le code

- Préférences : elles **réordonnent** le catalogue et l'actualité sans jamais masquer de marque (`preferenceScore`).
- Modèle, génération et version sont des entités distinctes ; les caractéristiques n'existent que sur une **version**.
- Prix toujours accompagnés de leur marché, version, type (officiel, de départ, de version, estimation) et date. Aucun repli silencieux vers un autre pays : il est nommé. Une estimation sans fourchette est refusée.
- Dates partielles (« 2027 », « début 2027 ») jamais complétées. Une sortie « en 2027 » n'apparaît pas dans « 3 mois ».
- Présentation, commandes, production, livraisons et disponibilité sont distinctes ; les cartes indiquent quelle étape est datée.
- Rumeurs et informations de presse sont séparées des annonces officielles.
- « Qu'est-ce qui change ? » n'apparaît que si la génération précédente et une paire de versions comparables sont identifiées.
- Comparateur : alerte si les versions comparées ne sont pas du même niveau de gamme, sans classement global.
- Résultats sportifs rattachés à la saison, à la manche et à la classe ; classements datés (« après la manche N »).

## Persistance et synchronisation

- Préférences et favoris sont écrits **immédiatement** en local, puis synchronisés avec l'API (SQLite).
- Hors ligne, les opérations sont mises en file et rejouées au retour du réseau (nouvelle tentative après 30 s ou à l'événement `online`).
- La wishlist conserve un **instantané** de chaque voiture : l'historique survit à un changement de génération ou au retrait d'une fiche.
- Multi-appareils : *Profil → Utiliser le profil d'un autre appareil*, en saisissant l'identifiant du profil (application personnelle, sans comptes ni mot de passe).

## Variables d'environnement

Voir `server/.env.example`. Aucune n'est obligatoire et aucune clé secrète n'est requise.

## Tests

- `server/test` (node:test, 24 tests) : dates partielles et fenêtres de sortie, validation du catalogue, catégories dérivées des versions, comparaison désactivée sans génération précédente, prix sans repli silencieux, préférences non bloquantes, recherche, similarité, analyse RSS et Atom, dédoublonnage, classification, API profil et wishlist, cache servi en cas de panne, statuts sportifs.
- `web/src/test` (Vitest, 7 tests) : ordre de priorité des prix, rendu des cartes, cœur avec persistance hors ligne, libellé de l'étape datée.
- Vérifié manuellement dans le navigateur (desktop et 375 px) : onboarding complet et partiel, accueil, Explorer, fiche, comparateur, wishlist, nouveautés, F1 et WEC.

## Ce qui reste à faire ou à configurer

- **Notifications et alertes** (sorties, nouvelles générations, actualité de la wishlist) : non implémentées, signalées comme telles dans le Profil.
- **Actualisation automatique du catalogue, des nouveautés et du WEC/WRC** : pas de source ouverte ; mise à jour manuelle des JSON (ou partenariat de données / API payante).
- **Comptes utilisateurs** : la synchronisation repose sur un identifiant de profil, suffisant pour un usage personnel, pas pour un service public.
- **Wikimedia** : renseignez `HTTP_USER_AGENT` avec un contact réel avant un usage soutenu.
- Collections personnelles, calendrier exportable, historique de consultation : non implémentés (fonctionnalités secondaires).
