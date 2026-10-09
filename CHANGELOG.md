# Changelog

All notable changes to centime are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semantic versioning](https://semver.org).

The section matching the released version is attached automatically as the GitHub release notes.

## [0.1.1] - 2026-10-08

### Added

- Android app: CI now builds a signed `centime_<version>.apk` (arm64 + arm32) and attaches it to each release.
- Pairing by QR code: **Settings › Connect another device** shows a QR code holding the recovery key and the server address, and the Android app can scan it on first launch instead of typing the key.
- Transactions: **New transaction** records an operation by hand (account, date, label, merchant, amount, category), for what no statement carries.
- Transactions: on small screens, the table becomes a card list and the filters collapse behind a **Filters** button showing the number of active filters.

### Changed

- Mobile layout keeps the header, content and sidebar clear of the Android system bars (edge-to-edge safe areas).
- Long dialogs now size against the visible viewport, so the on-screen keyboard no longer hides them.
- Larger touch targets on mobile: row actions, month navigation, category badge and fixed-item indicator.

### Fixed

- The Android app now uses the centime icon instead of the default Tauri one.

## [0.1.0] - 2026-10-08

First release: budget tracking with accounts, CSV import, categories and rules, fixed items, budgets and dashboard; end-to-end encrypted synchronization; web and desktop (Windows, macOS, Linux) apps.
