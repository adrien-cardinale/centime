# centime

Application de gestion de budget personnelle, mono-utilisateur.

## Fonctionnalités

- **Import** : relevés CSV (profils de fournisseurs configurables) et camt.053 (XML), détection des doublons, mise à jour des transactions en suspens.
- **Catégories et règles** : arborescence de catégories, règles « contient » ou regex sur le libellé, le commerçant ou la catégorie du fournisseur, application à l'import ou à la demande.
- **Postes fixes** : charges et revenus récurrents (mensuels, trimestriels, annuels), rapprochement automatique des transactions, échéances à venir et en retard.
- **Budgets** : plafonds par catégorie (sous-catégories incluses), report du solde, projection au rythme actuel, historique.
- **Plan du mois** : postes fixes et budgets réunis sur une seule page, avec le reste du mois (revenus fixes − charges fixes − enveloppes).
- **Tableau de bord** : solde bancaire, dépenses, revenus et net du mois comparés au mois précédent, points d'attention, revenus et dépenses sur 12 mois, dépenses par catégorie, évolution du solde, budgets, échéances et dernières transactions.
- **Export** : export CSV (séparateur `;`, UTF-8 avec BOM) des transactions selon les filtres de la page Transactions.

## Structure

- `packages/core` : types du domaine et logique métier pure.
- `packages/db` : schéma Drizzle (SQLite / libSQL), migrations regroupées et migrateur portable.
- `packages/services` : logique métier partagée (comptes, imports, transactions, règles, budgets, synchronisation), sans dépendance au runtime serveur ni au navigateur.
- `apps/server` : API Hono, authentification, service du build web.
- `apps/web` : interface React (Vite, TanStack Router, TanStack Query, shadcn/ui), partagée entre le web et le bureau.
- `apps/desktop` : coque Tauri 2 de l'application de bureau.

## Prérequis

- Bun 1.3.6 ou plus récent (voir le champ `packageManager` de `package.json`). Installation : https://bun.sh/docs/installation, par exemple `curl -fsSL https://bun.sh/install | bash`.

## Installation

```sh
bun install
cp .env.example .env
```

Renseignez `APP_PASSWORD` et `SESSION_SECRET` dans `.env`.

## Développement

```sh
bun run dev
```

- API : http://localhost:3000
- Interface : http://localhost:5173 (proxy `/api` vers l'API)

Les migrations s'appliquent au démarrage du serveur. La base se trouve par défaut dans `data/centime.db`.

## Commandes

| Commande | Rôle |
| --- | --- |
| `bun run build` | Vérifie les types de core, db et services puis construit l'interface web |
| `bun run typecheck` | Vérification des types de tous les paquets |
| `bun run test` | Tests unitaires (`bun test`), paquet par paquet |
| `bun run db:generate` | Génère une migration après modification du schéma et régénère `migrations.generated.ts` |
| `bun run db:bundle` | Régénère `migrations.generated.ts` à partir du dossier `drizzle/` |
| `bun run db:migrate` | Applique les migrations sans démarrer le serveur |
| `bun run desktop:dev` | Lance l'application de bureau en développement |
| `bun run desktop:build` | Construit l'installateur de l'application de bureau |

`bun test` à la racine lance aussi tous les tests en un seul rapport.

Le serveur n'a pas d'étape de build : Bun exécute le TypeScript directement. Après `bun run build`, lancez l'application avec `bun run start`.

## Jetons d'API

Un client sans cookie, comme l'application de bureau, s'authentifie avec un jeton. `POST /api/auth/token` avec `{ "password", "label" }` vérifie le mot de passe et renvoie le jeton en clair une seule fois ; seul son hash SHA-256 est stocké. Le client l'envoie ensuite dans l'en-tête `Authorization: Bearer <jeton>`. Avec une session ouverte, `GET /api/auth/tokens` liste les jetons sans leur secret et `DELETE /api/auth/tokens/:id` en révoque un.

## Synchronisation

Le serveur reste la source de vérité. Chaque ligne synchronisée porte une colonne `sync_version` : `NULL` signifie « modifiée, pas encore estampillée ». À chaque échange, le serveur numérote ces lignes avec une séquence globale. `GET /api/sync/pull?since=<curseur>` renvoie les lignes modifiées depuis ce curseur, suppressions logiques comprises, par pages de 5 000 lignes au plus par table ; le client rappelle avec le nouveau `cursor` tant que `hasMore` vaut `true`. `POST /api/sync/push` applique les lignes du client selon la règle « la dernière modification gagne » (`updatedAt`) et renvoie les lignes refusées avec leur version serveur, par exemple lors d'une collision d'empreinte de transaction.

### Côté client

L'application de bureau garde sa propre base SQLite et envoie ses modifications au serveur :

1. **Réception** : le client appelle `pull` depuis son curseur, page par page. Une ligne reçue remplace la ligne locale, sauf si la ligne locale n'est pas encore envoyée et plus récente. Une ligne locale jamais envoyée qui entre en collision sur une clé unique (identifiant de compte, empreinte de transaction) est supprimée au profit de la ligne serveur.
2. **Envoi** : les lignes locales dont `sync_version` vaut `NULL` partent par paquets de 500. Les lignes acceptées reçoivent leur version serveur, les lignes refusées sont remplacées par la version serveur.
3. Si d'autres changements ont été estampillés pendant l'envoi, le client refait une réception pour ne rien manquer.

La synchronisation se lance au démarrage, toutes les 5 minutes, 5 secondes après chaque modification et à la demande depuis la barre latérale.

## Application de bureau

L'application de bureau est la même interface que le web, empaquetée avec Tauri 2. Elle fonctionne hors ligne : les services métier tournent dans la fenêtre, sur une base SQLite locale (sql.js en WebAssembly).

### Prérequis

- Rust stable (`rustup`).
- Les dépendances système de Tauri pour votre système : WebView2 sous Windows, Xcode Command Line Tools sous macOS, WebKitGTK 4.1 et ses bibliothèques sous Linux. La liste exacte se trouve sur https://v2.tauri.app/start/prerequisites/.

### Commandes

```sh
bun run desktop:dev
bun run desktop:build
```

`desktop:dev` démarre Vite en mode `desktop` sur le port 5174 puis ouvre la fenêtre. `desktop:build` construit l'interface dans `apps/web/dist-desktop` puis l'installateur dans `apps/desktop/src-tauri/target/release/bundle`.

Pour régénérer les icônes à partir de `apps/desktop/src-tauri/icons/icon.png` :

```sh
bun run --cwd apps/desktop icon
```

### Base locale

La base se trouve dans le dossier de données de l'application, fichier `centime.db` :

- Linux : `~/.local/share/ch.centime.desktop/`
- macOS : `~/Library/Application Support/ch.centime.desktop/`
- Windows : `%APPDATA%\ch.centime.desktop\`

Elle est enregistrée 500 ms après chaque modification et à la fermeture de la fenêtre, par écriture dans un fichier temporaire puis renommage.

### Connecter la synchronisation

1. Ouvrez **Paramètres › Synchronisation**.
2. Saisissez l'adresse du serveur, le mot de passe de l'application et un libellé pour l'appareil.
3. Cliquez sur **Connecter**. L'application obtient un jeton d'API puis lance une première synchronisation.

Le mot de passe n'est pas conservé. Le jeton se révoque depuis **Paramètres › Jetons d'API** dans l'interface web. Les catégories, règles et profils CSV par défaut arrivent du serveur ; sans serveur, le bouton **Créer les données par défaut** les crée localement.

## Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP |
| `DATABASE_URL` | `file:./data/centime.db` | Base libSQL, chemin relatif à la racine du dépôt |
| `APP_PASSWORD` | obligatoire | Mot de passe de connexion |
| `SESSION_SECRET` | obligatoire | Clé de signature du cookie de session |
| `STATIC_DIR` | `apps/web/dist` | Dossier du build web |
| `NODE_ENV` | `development` | `production` active les cookies sécurisés |
| `VITE_API_URL` | origine de la page | URL de l'API pour l'interface, lue au build web |

## Docker

```sh
docker compose up -d --build
```

L'image repose sur `oven/bun` (variante Debian `slim`) et lance `bun apps/server/src/index.ts`. Modifiez `APP_PASSWORD` et `SESSION_SECRET` dans `docker-compose.yml` avant le lancement. Les données sont stockées dans le volume monté sur `/app/data`.
