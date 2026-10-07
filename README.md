# centime

Personal, single-user budget management app. Data is end-to-end encrypted: the server is only a relay that stores opaque blobs.

## Features

- **Import**: CSV statements (configurable provider profiles) and camt.053 (XML), duplicate detection, update of pending transactions.
- **Categories and rules**: categories grouped by theme (transactions are filed under categories), "contains" or regex rules on the label, the merchant or the provider category, applied at import time or on demand.
- **Fixed items**: recurring expenses and income (monthly, quarterly, yearly), automatic transaction matching, upcoming and overdue items.
- **Budgets**: per-category caps, balance carry-over, projection at the current pace, history.
- **Month plan**: fixed items and budgets on a single page, with the remainder of the month (fixed income − fixed expenses − envelopes).
- **Dashboard**: bank balance, spending, income and net for the month compared with the previous month, points of attention, 12-month income and spending, spending by category, balance trend, budgets, due dates and latest transactions.
- **Export**: CSV export (`;` separator, UTF-8 with BOM) of transactions, following the filters of the Transactions page.

## Structure

- `packages/core`: domain types and pure business logic.
- `packages/db`: Drizzle schema (SQLite / libSQL), bundled migrations and a portable migrator.
- `packages/services`: shared business logic (accounts, imports, transactions, rules, budgets, sync row schemas), independent of both the server runtime and the browser.
- `apps/server`: Hono relay API (encrypted log storage on `bun:sqlite`) and web build serving. It holds no business data and no business logic.
- `apps/web`: React UI (Vite, TanStack Router, TanStack Query, shadcn/ui), shared between web and desktop. Encryption and synchronization run here, in `src/lib/crypto` and `src/lib/sync`.
- `apps/desktop`: Tauri 2 shell of the desktop application.

## Prerequisites

- Bun 1.3.6 or newer (see the `packageManager` field of `package.json`). Install: https://bun.sh/docs/installation, for example `curl -fsSL https://bun.sh/install | bash`.

## Installation

```sh
bun install
cp .env.example .env
```

All server variables have defaults; edit `.env` only to change them.

## Development

```sh
bun run dev
```

- API: http://localhost:3000
- UI: http://localhost:5173 (proxies `/api` to the API)

The relay database is created on first start, by default in `data/relay.db`.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run build` | Type-checks core, db and services, then builds the web UI |
| `bun run typecheck` | Type-checks every package |
| `bun run test` | Unit tests (`bun test`), package by package |
| `bun run db:generate` | Generates a migration after a schema change and regenerates `migrations.generated.ts` |
| `bun run db:bundle` | Regenerates `migrations.generated.ts` from the `drizzle/` folder |
| `bun run db:migrate` | Applies migrations without starting the server |
| `bun run desktop:dev` | Runs the desktop app in development |
| `bun run desktop:build` | Builds the desktop installer |

`bun test` at the root also runs every test in a single report.

The server has no build step: Bun runs the TypeScript directly. After `bun run build`, start the app with `bun run start`.

## Encryption model

Each client (browser or desktop) keeps its own SQLite database with all the business data. The server never sees it in clear text.

- **Master key**: 32 random bytes generated on the client. It is shown to the user as a recovery key: Crockford base32 in groups of four characters, with a 2-byte checksum so typos are detected (`I`, `L` and `O` are accepted for `1`, `1` and `0`). Anyone holding this key can read the data; losing it makes the data unrecoverable.
- **Derived values** (HKDF-SHA-256, salt `centime/v1`): a public **user id** (32 hex characters), an **auth secret** and an **AES-256-GCM encryption key**. The master key itself never leaves the device.
- **Sealed blobs**: each payload is encrypted with a random 12-byte IV, prefixed by a format version byte, with the user id bound as additional authenticated data.
- **Authentication**: requests carry `Authorization: Bearer <userId>.<secret>`. The server stores only the SHA-256 hash of the secret and compares it in constant time. There is no password and no session.

Because the server cannot read or merge data, conflict resolution happens on the clients (see below).

## Relay API

All routes live under `/api`. Bodies are JSON; `data` is base64 of a sealed blob (8 MiB max per entry, 9 MiB max per request).

| Route | Description |
| --- | --- |
| `GET /api/health` | Returns `{ "status": "ok" }` |
| `POST /api/log` | Appends `{ "data" }` to the user's log and returns `{ "seq" }` (201). The first append from an unknown user id creates the account (403 if signups are closed); later appends need the matching secret (401 otherwise) |
| `GET /api/log?since=<seq>&limit=<n>` | Returns `{ entries: [{ seq, data }], cursor, hasMore }` for entries after `since`. `limit` defaults to 200 and is capped at 500; a page is also capped at 8 MiB. Call again with the returned `cursor` while `hasMore` is `true` |
| `DELETE /api/account` | Deletes the user and the whole log (204) |

The log is append-only: entries are numbered per user with a gapless sequence (`seq`), stored in SQLite (WAL mode).

## Synchronization

The server is a dumb, ordered log; clients do the merging.

1. **Pull**: a client reads the log from its stored cursor, page by page, decrypts each entry and applies the rows it contains.
2. **Push**: local rows not yet sent (`sync_version` is `NULL`) are sent in batches, each sealed and appended to the log. Accepted rows get their sequence number as `sync_version`.
3. **Conflicts** are resolved locally when a row is applied: the most recent `updatedAt` wins, even over an already-synchronized local row, so a server cannot replay a stale entry. When two devices create the same account or import the same transaction offline, the smallest id wins everywhere; the losing account is recorded as an alias (`sync_alias:<id>` setting) so transactions that still reference it are remapped.
4. An entry that fails to decrypt aborts the sync with an error: the key does not match, or the data was tampered with.

Synchronization runs at startup, every 5 minutes, 5 seconds after each change and on demand from the sidebar.

## Desktop app

The desktop app is the same UI as the web one, packaged with Tauri 2. It works offline: the business services run in the window, on a local SQLite database (sql.js in WebAssembly).

### Prerequisites

- Stable Rust (`rustup`).
- Tauri system dependencies for your OS: WebView2 on Windows, Xcode Command Line Tools on macOS, WebKitGTK 4.1 and its libraries on Linux. The exact list is at https://v2.tauri.app/start/prerequisites/.

### Commands

```sh
bun run desktop:dev
bun run desktop:build
```

`desktop:dev` starts Vite in `desktop` mode on port 5174, then opens the window. `desktop:build` builds the UI into `apps/web/dist-desktop`, then the installer into `apps/desktop/src-tauri/target/release/bundle`.

To regenerate the icons from `apps/desktop/src-tauri/icons/icon.png`:

```sh
bun run --cwd apps/desktop icon
```

### Local database

The database lives in the application data folder, file `centime.db`:

- Linux: `~/.local/share/ch.centime.desktop/`
- macOS: `~/Library/Application Support/ch.centime.desktop/`
- Windows: `%APPDATA%\ch.centime.desktop\`

It is saved 500 ms after each change and when the window closes, by writing a temporary file then renaming it. The file is **encrypted** (AES-256-GCM, same format as the sync entries); a plain SQLite file from an earlier version is read once and re-encrypted on the next save. In the browser, the sealed database is kept in IndexedDB instead.

The master key is stored on the device, next to the database (`master.key`) in the desktop app, or in IndexedDB in the browser. Disk encryption (BitLocker, FileVault…) is still advisable: anyone who can read the whole application data folder can read both the key and the database.

### Connecting synchronization

1. On first launch the app asks for a key: **create a new one** (and save the displayed recovery key somewhere safe) or **enter an existing one** to join your data on another device.
2. On the desktop app, enter the server address on that screen, or later in **Settings › Synchronization**. In the browser the server is the one that served the page, so synchronization starts automatically.
3. The app derives its credentials from the key and runs a first synchronization. **Settings** also lets you display the recovery key again.

The recovery key is what lets a new device join the same data; there is nothing to revoke server-side except deleting the account (`DELETE /api/account`). Web Crypto requires a secure context, so serve the browser version over HTTPS (or from `localhost`).
