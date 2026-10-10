# Changelog

All notable changes to centime are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semantic versioning](https://semver.org).

The section matching the released version is attached automatically as the GitHub release notes.

## [Unreleased]

### Added

- Receipts: **Crop** on the photo step frames the receipt before reading. The frame is suggested from the bright area of the photo and can be moved and resized by its corners; **Original image** restores the uncropped photo.
- Receipts: after an on-device reading, **Text read by the OCR** shows the raw recognized text in a collapsible section.

### Changed

- Receipts: on-device text recognition now reads the original photo at full resolution (up to 3000 pixels) instead of the 1600-pixel copy, and uses Tesseract's single-block page mode. Far or small receipts lose fewer lines.
- Receipts: when the lines do not add up to the total, the warning shows the gap instead of only both amounts.

## [0.4.0] - 2026-10-10

### Added

- Split a transaction over several categories. On the **Transactions** page, the row menu offers **Split…**: each line has a category, an amount and an optional note, and the lines must add up to the transaction amount. A split transaction shows a **Split** badge with its lines in the category column; click it to edit the split or **Undo split**. The dashboard, budgets, category filters, category counts and the CSV export (one row per line, with a new **Note** column) count each line in its own category. Rules leave split transactions untouched, and choosing a category, a fixed item or a transfer for a split transaction removes its split.
- Receipts. The new **Receipts** page captures a receipt with the camera, a photo or a PDF (up to 7 MB); photos are straightened and reduced to 1600 pixels. Each receipt records the merchant, the total, the date, a note and optional line items with a category. Centime suggests the matching transactions of the same account, rated by likelihood; **Link automatically** links every receipt with a single clear match, and **Attach a receipt** in a transaction's menu links one directly. A linked receipt whose lines cover several categories can split the transaction line by line. A small icon marks the transactions with a receipt.
- Receipts: text recognition on the device (tesseract.js) pre-fills the merchant, total, date and lines of a photographed receipt.
- Receipts: optional reading by Claude (Anthropic's AI). Off by default; **Settings › AI receipt reading** turns it on with your own Anthropic API key and a model (default `claude-opus-5-5`). When on, the receipt photo and your category names are sent from the device to Anthropic's API, which returns the merchant, total, date, currency and lines with a suggested category. The key stays in the encrypted local database and is never synchronized. Photos only, not PDFs.
- Receipt images are encrypted on the device and synchronized through the relay as opaque files: after each sync, a device uploads the images the relay lacks and downloads the ones it lacks (20 per sync at most), and deleting a receipt deletes its image everywhere. Opening a receipt whose image is not on the device yet fetches it at once. **Settings › Sync** shows when images could not be synchronized.
- Relay: new `/api/blob` routes store encrypted files (`PUT`, `GET`, `DELETE /api/blob/<id>`, 8 MiB max per file, and `GET /api/blob` to list them). `DELETE /api/account` also deletes the files.

### Changed

- Relay: the `MAX_USER_BYTES` quota now covers the files as well as the log.

## [0.3.0] - 2026-10-10

### Added

- The web app also builds as a static site (`build:static`, path set by `BASE_PATH`) and runs without a relay. It is published on GitHub Pages under `app/`, and asks for the relay address at first launch, like the desktop app.
- Relay: `ALLOWED_ORIGINS` (comma-separated) lets a web app hosted on another origin, such as GitHub Pages, synchronize with the relay.
- Several accounts on one device. Each account has its own key and its own encrypted database, under `accounts/<id>/` in the desktop app. The **Accounts** card in Settings lists them, renames them, switches the active one (the app reloads) and adds one with the same create, restore or scan steps as the first launch. With two accounts or more, an account switcher appears at the bottom of the sidebar. The `centime.db` and `master.key` of an earlier version are moved automatically.
- Settings: **Remove this account from this device** erases the active account's key and local database, then switches to the next account, or returns to the welcome screen if none is left; server data stays available to other devices. **Delete the account on the server** (when sync is configured) deletes all server data for every device, then does the same local removal.

## [0.2.1] - 2026-10-10

### Changed

- Mobile layout: budgets, fixed items, accounts and the import preview become card lists on small screens; filters, pickers and transaction bulk actions open in bottom sheets, and the bulk actions bar stays pinned at the bottom.
- **New transaction** now asks for the amount without a sign and an **Expense** / **Income** toggle; a comma works as decimal separator.
- Dashboard: points of attention and latest transactions are now clickable rows leading to the matching transactions; on small screens, spending by category is shown as a list and the charts cover the last 6 months.
- Larger touch targets throughout: dialogs scroll on short screens, close buttons and controls are at least 44 px, and the sidebar closes after navigating.
- Android: the back button closes open dialogs, sheets and menus instead of leaving the app.

### Fixed

- Android: CSV export now saves the file in the app's Download folder and shows its path.
- Android: the content shrinks above the on-screen keyboard (Android 15), and the window opens on centime's dark background in dark mode.
- Android: when camera access was denied, the QR code scan offers to open the device settings or to type the key by hand.

## [0.2.0] - 2026-10-10

### Added

- Automatic updates: **Settings › Updates** shows the installed version and compares it with the latest release. The desktop app downloads the signed package, installs it and restarts; the Android app downloads the `.apk`; the browser version links to the release.
- Pairing by QR code: **Settings › Encryption key** shows a QR code holding the encryption key and the server address, and the Android app can scan it on first launch instead of typing the key.
- Transactions: **New transaction** records an operation by hand (account, date, label, merchant, amount, category), for what no statement carries.

## [0.1.1] - 2026-10-08

### Added

- Android app: CI now builds a signed `centime_<version>.apk` (arm64 + arm32) and attaches it to each release.
- Transactions: on small screens, the table becomes a card list and the filters collapse behind a **Filters** button showing the number of active filters.

### Changed

- Mobile layout keeps the header, content and sidebar clear of the Android system bars (edge-to-edge safe areas).
- Long dialogs now size against the visible viewport, so the on-screen keyboard no longer hides them.
- Larger touch targets on mobile: row actions, month navigation, category badge and fixed-item indicator.

### Fixed

- The Android app now uses the centime icon instead of the default Tauri one.

## [0.1.0] - 2026-10-08

First release: budget tracking with accounts, CSV import, categories and rules, fixed items, budgets and dashboard; end-to-end encrypted synchronization; web and desktop (Windows, macOS, Linux) apps.
