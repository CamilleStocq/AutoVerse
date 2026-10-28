# Activer les notifications push (une seule fois, 10 minutes)

Les notifications arrivent même quand l'application est fermée, sur Android et sur iPhone/iPad. Sur iPhone/iPad, l'application doit être ajoutée à l'écran d'accueil (iOS 16.4 ou plus récent).

Fonctionnement :
- GitHub Actions détecte les nouvelles alertes à chaque mise à jour : nouvelles dates de sortie, résultats F1, WEC et WRC.
- Il envoie ensuite les notifications aux appareils abonnés.
- Ce petit Worker Cloudflare (offre gratuite) garde la liste des abonnements : une adresse technique par appareil, sans nom ni e-mail.

Toutes les valeurs à recopier (clés et jeton) sont dans le fichier local `push-worker/CONFIG-A-RECOPIER.local.txt`. Il n'est **pas** publié sur GitHub ; gardez-le pour vous.

## 1. Cloudflare : créer le registre des abonnements

1. Créer un compte gratuit sur https://dash.cloudflare.com/sign-up.
2. **Storage & Databases → KV → Create** : nom `autoverse-push`.
3. **Compute (Workers) → Create → Start with Hello World** : nom `autoverse-push`, puis **Deploy**.
4. **Edit code** : remplacer tout le contenu par celui de `push-worker/worker.js`, puis **Deploy**.
5. Dans le Worker, ouvrir **Settings** :
   - **Bindings → Add → KV namespace** : nom de variable `SUBSCRIPTIONS`, namespace `autoverse-push`.
   - **Variables and Secrets → Add** :
     - type *Secret*, nom `ADMIN_TOKEN`, valeur prise dans le fichier local ;
     - type *Text*, nom `ALLOWED_ORIGIN`, valeur `https://camillestocq.github.io`.
   - **Deploy** pour appliquer.
6. Noter l'adresse du Worker, par exemple `https://autoverse-push.<votre-sous-domaine>.workers.dev`.

## 2. GitHub : donner les clés au workflow

Dans le dépôt : **Settings → Secrets and variables → Actions**.

- Onglet **Secrets** → *New repository secret* :
  - `PUSH_ADMIN_TOKEN` : même valeur que `ADMIN_TOKEN` ;
  - `VAPID_PRIVATE_KEY`.
- Onglet **Variables** → *New repository variable* :
  - `VAPID_PUBLIC_KEY` ;
  - `PUSH_API_URL` : l'adresse du Worker notée à l'étape 1.6.

Ensuite, dans **Actions → Publier Autoverse → Run workflow**, lancer une publication.

## 3. Sur chaque appareil

Ouvrir l'application → **Alertes** → **Activer les notifications**, puis choisir les sujets :
- nouvelles dates de sortie, éventuellement limitées à vos marques ;
- résultats F1 ;
- résultats WEC ;
- résultats WRC.

## Bon à savoir

- Les données sont vérifiées toutes les 30 minutes environ (GitHub peut décaler l'exécution de quelques minutes). Une notification arrive donc au plus tard dans l'heure qui suit la publication d'un résultat officiel.
- Plusieurs alertes simultanées (plus de 3) sont regroupées en une seule notification.
- Les appareils désinscrits ou désinstallés sont retirés automatiquement du registre.
- Sans cette configuration, l'application fonctionne normalement : les alertes restent visibles dans la page **Alertes**.
