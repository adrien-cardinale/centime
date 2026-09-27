# centime

Application de gestion de budget personnelle, mono-utilisateur.

## Fonctionnalités

- **Import** : relevés CSV (profils de fournisseurs configurables) et camt.053 (XML), détection des doublons, mise à jour des transactions en suspens.
- **Catégories et règles** : arborescence de catégories, règles « contient » ou regex sur le libellé, le commerçant ou la catégorie du fournisseur, application à l'import ou à la demande.
- **Postes fixes** : charges et revenus récurrents (mensuels, trimestriels, annuels), rapprochement automatique des transactions, échéances à venir et en retard.
- **Budgets** : plafonds par catégorie (sous-catégories incluses), report du solde, projection au rythme actuel, historique.
- **Tableau de bord** : solde bancaire, dépenses, revenus et net du mois comparés au mois précédent, points d'attention, revenus et dépenses sur 12 mois, dépenses par catégorie, évolution du solde, budgets, échéances et dernières transactions.
- **Export** : export CSV (séparateur `;`, UTF-8 avec BOM) des transactions selon les filtres de la page Transactions.

## Structure

- `packages/core` : types du domaine et logique métier pure.
- `packages/db` : schéma Drizzle (SQLite / libSQL) et migrations.
- `apps/server` : API Hono, authentification, service du build web.
- `apps/web` : interface React (Vite, TanStack Router, TanStack Query, shadcn/ui).

## Prérequis

- Node.js 22 (voir `.nvmrc`)
- pnpm 10

## Installation

```sh
pnpm install
cp .env.example .env
```

Renseignez `APP_PASSWORD` et `SESSION_SECRET` dans `.env`.

## Développement

```sh
pnpm dev
```

- API : http://localhost:3000
- Interface : http://localhost:5173 (proxy `/api` vers l'API)

Les migrations s'appliquent au démarrage du serveur. La base se trouve par défaut dans `data/centime.db`.

## Commandes

| Commande | Rôle |
| --- | --- |
| `pnpm build` | Build de core, db, web puis server |
| `pnpm typecheck` | Vérification des types de tous les paquets |
| `pnpm test` | Tests unitaires (vitest) |
| `pnpm db:generate` | Génère une migration après modification du schéma |
| `pnpm db:migrate` | Applique les migrations sans démarrer le serveur |

Après `pnpm build`, lancez l'application avec `node apps/server/dist/index.js`.

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

Modifiez `APP_PASSWORD` et `SESSION_SECRET` dans `docker-compose.yml` avant le lancement. Les données sont stockées dans le volume monté sur `/app/data`.
