# Changelog

All notable changes to centime are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semantic versioning](https://semver.org).

The section matching the released version is attached automatically as the GitHub release notes.

## [Unreleased]

### Added

- The web app also builds as a static site (`build:static`, path set by `BASE_PATH`) and runs without a relay. It is published on GitHub Pages under `app/`, and asks for the relay address at first launch, like the desktop app.
- Relay: `ALLOWED_ORIGINS` (comma-separated) lets a web app hosted on another origin, such as GitHub Pages, synchronize with the relay.

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
