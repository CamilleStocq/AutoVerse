# Consigne : ajouter des fiches au catalogue Autoverse

Ce fichier décrit comment écrire un fichier de fiches `server/data/seed/catalog-<lettre>.json`.
Il sert aux ajouts en série (objectif : ~500 cartes à collectionner, une carte par version).

## Format

- Fichier : `{ "generations": [ ... ] }`.
- Modèle complet à copier : l'entrée `renault-5-e-tech` de `catalog-b.json`.
- Schéma exact (enums, champs obligatoires) : `server/src/catalog/schema.ts`.
- Marques autorisées : celles de `brands.json`, avec leur `id`. N'ajoutez pas de marque : signalez-la plutôt dans votre rapport.
- Identifiants :
  - fiche : `marque-modele-generation` (minuscules, tirets) ;
  - version : préfixée par l'identifiant de la fiche.
- Dates : `retrievedAt` et `updatedAt` = `"2026-10-28"`.
- Aucun doublon : avant d'écrire, lisez les `id` de **tous** les `catalog-*.json` et de `upcoming.json`. D'autres personnes écrivent des fichiers en parallèle, relisez-les juste avant de valider.
- **Une carte = une version.** Mettez 1 à 3 versions par fiche, clairement distinctes (base / sport / haut de gamme, ou coupé / cabriolet). Pour une voiture de course ou une série unique, une seule version est normale.

### Statut et catégories

| Type de voiture | `status` | Catégories et champs |
|---|---|---|
| Modèle neuf en vente | `"on-sale"` | — |
| Ancien modèle (icône, plus produit) | `"discontinued"` | Ajouter `"classic"` si c'est une icône de collection. |
| Voiture de course actuelle (Hypercar WEC, GT3, Rally1, Rally2…) | `"racing"` | Ajouter `"endurance"` ou `"rally"` ; `priceRange: null` ; `usage: ["track"]`. |
| Voiture de course historique (Porsche 917, Lancia Stratos…) | `"discontinued"` | Ajouter `"classic"` et `"endurance"` ou `"rally"`. |

- Autres catégories possibles (enum) : `sports`, `supercar`, `coupe`, `convertible`, `gt`, `sport-sedan`, `sport-suv`, etc.
- N'ajoutez **jamais** `ev`, `phev`, `hybrid` ou `ice` : le serveur les calcule à partir des versions.
- `launch: null`, `upcoming: null`, `changes: null`, sauf si vous avez une source.

## Règles absolues sur les données

Le principe de l'app : ne jamais inventer. Enfreindre une règle est pire que de laisser un champ vide.

1. **Chaque valeur chiffrée vient d'une source réellement consultée** (WebFetch ou WebSearch). Sont concernés : ch, kW, Nm, 0-100, vitesse max, consommation WLTP, autonomie, CO2, poids, dimensions, coffre et prix.
   - Sources par ordre de préférence : constructeur (presse, fiche technique), championnat ou équipe pour la course, base de données ou presse reconnue.
   - Un extrait de résultat de recherche ne suffit pas. Ouvrez la page qui donne le chiffre et citez cette page. Si vous ne pouvez pas l'ouvrir, la valeur reste `null`.
   - Valeur inconnue → `null` (ou `[]` pour une liste).
   - Les réserves vont dans `notes` de la version, par exemple : « puissance limitée par la BoP », « valeur d'époque, norme DIN ».
2. **Les stats d'une version ne sont jamais mélangées avec celles d'une autre.**
3. **Prix :**
   - Marché `BE` en priorité, puis `FR`, puis `DE`, `GB` ou `CH` dans la bonne devise.
   - `type` = `range-start` ou `variant`, avec `asOf` (AAAA-MM) et une source.
   - Ancien modèle : son prix neuf d'époque **seulement** s'il est sourcé ; sinon `"prices": []`.
   - Jamais de conversion, jamais d'estimation maison.
   - Voiture de course : `"prices": []`, sauf prix client publié (certaines GT3).
4. **Textes :**
   - En français, factuels. La première phrase de `summary` s'affiche sur la carte : courte et informative.
   - `technicalFacts` : faits vérifiables uniquement.
   - `pros` et `compromises` : opinions mesurées.
5. **Photos :**
   - 1 ou 2 fichiers Wikimedia Commons qui montrent **cette** génération ou cette voiture.
   - Vérifiez que chaque fichier existe : `https://commons.wikimedia.org/w/api.php?action=query&titles=File:NOM.jpg&format=json`. La mention `"missing"` signifie qu'il n'existe pas.
   - Champs : `commonsFile: "File:…"`, `depicts` précis, `isOfficial: false`, `resolved: null`.
   - Si vous ne pouvez rien vérifier : `"images": []`.
  - Wikimedia limite le débit, et plusieurs personnes l'interrogent en même temps. Regroupez les vérifications : un seul appel peut contenir jusqu'à 50 titres séparés par `|`. Envoyez l'en-tête `User-Agent: autoverse-data/1.0`. En cas de refus pour trop de requêtes, attendez une minute avant de réessayer.
6. **Sources :** chaque fiche a au moins une source dans `sources`, et chaque version a ses propres `sources`.

## Validation (obligatoire)

```
cd "C:\Users\Camille.Stocq\OneDrive - Groupe NSI\Documents\myThings\autoverse\server" && node --input-type=module -e "import {loadCatalog} from './src/catalog/store.ts'; const s=loadCatalog(); console.log(s.generations.size, s.warnings)"
```

- Corrigez jusqu'à ce qu'il n'y ait **aucun avertissement mentionnant votre fichier**.
- Ne commitez rien et ne poussez rien.
- Ne modifiez aucun autre fichier.

## Rapport (court)

- Les `id` de fiches, avec le nombre de versions de chacune.
- Les modèles sautés ou remplacés, et pourquoi.
- Les champs laissés à `null` faute de source.
- Les marques manquantes, le cas échéant.
