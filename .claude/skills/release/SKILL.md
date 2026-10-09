---
name: release
description: Prepare a new centime release end to end — pick the semver number, bump the three version files, write the CHANGELOG section, verify README / site docs / screenshots / translations are still accurate, run the quality gate, and commit. Use this skill whenever the user talks about cutting, preparing or shipping a version ("prépare la v0.2.0", "nouvelle version", "on sort une release", "bump the version", "release notes", "update the changelog for the release"), or asks whether the docs and screenshots are up to date before tagging. Use it even for a small patch release, since the CI refuses a tag whose version files or changelog section are off.
---

# Preparing a centime release

## Why the preparation matters

A release here is just a tag: pushing `v<X.Y.Z>` on `main` starts `.github/workflows/desktop.yml`, which

1. checks that `apps/desktop/package.json`, `Cargo.toml`, `Cargo.lock` and the tag all carry the same version (`apps/desktop/scripts/check-version.ts`),
2. checks that `CHANGELOG.md` has a `## [X.Y.Z]` section (`apps/desktop/scripts/release-notes.ts`),
3. typechecks and tests, builds the Windows / macOS / Linux installers and the signed Android APK, then publishes the GitHub release with that changelog section as the release notes.

So every mistake surfaces *after* the tag exists, when fixing it means deleting a tag and a half-published release. The whole point of this skill is to get the repository into a state where the tag can only succeed — and to notice the things CI cannot check at all: stale documentation and stale screenshots.

The release version is the **desktop app version**. The other workspace packages (`apps/web`, `apps/server`, `packages/*`) are private, never published, and deliberately left at their own version — do not bump them unless the user asks.

## Step 1 — Audit the repository

Run the bundled audit first; it collects in one pass what would otherwise take a dozen commands:

```sh
bun .claude/skills/release/scripts/release-audit.ts [target-version]
```

It reports the three declared versions and whether they agree, the commits and touched areas since the last tag, which screenshots have code changes behind them, whether `en.json` and `fr.json` are at parity, and whether the changelog section already exists.

Then read the commits since the last tag yourself (`git log --oneline <lastTag>..HEAD`, `git diff --stat <lastTag>..HEAD`). The audit tells you *where* things moved; only reading the diff tells you *what a user will notice*, which is what the changelog and the version number depend on.

If the working tree is dirty, sort that out before going further: either the pending work belongs in this release (commit it, normally before the release commit) or it does not (stash it). A release built from a half-committed tree is impossible to reproduce.

## Step 2 — Choose the version

Propose a number with a one-line justification and let the user confirm — the judgement about what counts as "breaking" for their users is theirs.

The project is pre-1.0 and follows semver: a breaking change (sync protocol, encryption format, database migration that an older build cannot read, removed API route) goes in the minor while major stays at 0; a new user-visible capability also goes in the minor; a release that only fixes things goes in the patch. If the tag contains a hyphen (`v0.2.0-rc.1`), the workflow publishes it as a prerelease, which is the way to ship a build for testing.

## Step 3 — Bump the version files

Three files must carry the exact same string:

- `apps/desktop/package.json` → `"version"`
- `apps/desktop/src-tauri/Cargo.toml` → `version` in the `[package]` section
- `apps/desktop/src-tauri/Cargo.lock` → the `version` right under `name = "centime-desktop"`

`tauri.conf.json` has no version field on purpose (Tauri reads Cargo.toml), and the Android `versionCode` is derived by Tauri — do not add a version anywhere else, each extra copy is one more thing to desynchronize.

Verify with the same script CI uses, including the tag it will be given:

```sh
bun run desktop:check-version v<X.Y.Z>
```

## Step 4 — Write the changelog section

Insert the new section directly under the intro paragraph, above the previous version, and follow the conventions already in `CHANGELOG.md` (Keep a Changelog, English, today's date):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- Short sentence describing what the user can now do.

### Changed

### Fixed
```

Only keep the subsections that have entries, in the Keep a Changelog order (Added, Changed, Deprecated, Removed, Fixed, Security). Write from the user's point of view, in the voice of the existing entries: what changed for someone using the app, naming UI paths in bold (**Settings › Synchronization**) and file or command names in backticks. Internal refactors, CI tweaks and dependency bumps that change nothing observable do not belong here — the section becomes the public release notes, so a reader should be able to tell whether the update is worth installing. A release that genuinely has nothing user-visible is a sign the release itself may not be needed; say so rather than padding the list.

Check that the extraction CI performs returns what you expect:

```sh
bun apps/desktop/scripts/release-notes.ts v<X.Y.Z>
```

## Step 5 — Check the documentation against the release

Documentation drift is invisible to CI, so go through the diff since the last tag and, for each user-visible change, ask which of these files describes it:

- `README.md` — features list, `## Structure`, `## Prerequisites` (Bun version vs `packageManager` in `package.json`), the `## Commands` table (vs the root `scripts`), the desktop/Android sections, the encryption and sync descriptions.
- `site/docs/*.html` — `getting-started`, `importing`, `budgets`, `desktop`, `encryption`, `self-hosting`, `api`. These are hand-written pages deployed to GitHub Pages on every push to `main` that touches `site/`; `api.html` must match the relay routes in `apps/server`, and `self-hosting.html` the variables in `.env.example`.
- `apps/web/src/i18n/locales/{en,fr}.json` — a key missing on one side shows up raw in the UI. The audit reports the diff.

Useful cross-checks:

```sh
git diff <lastTag>..HEAD -- apps/server/src .env.example packages/db/drizzle   # API, config, migrations
grep -o 'bun run [a-z:-]*' README.md | sort -u                                 # commands documented
```

Fix what is wrong, and report what you deliberately left alone. Do not rewrite documentation beyond what this release changed: a release commit that also restructures the README is impossible to review.

## Step 6 — Check the screenshots

The audit flags each screen whose code moved after its screenshot was last committed. That is a suspicion, not a verdict: a refactor or an Android-only change often leaves the desktop view pixel-identical. Look at the flagged commits, decide whether the visible layout changed, and tell the user which captures you believe need retaking and why.

Retaking them is manual — there is no screenshot tooling in the repo, and taking them requires realistic data only the user has. When some are stale, say so plainly and give the conventions to follow: `site/screenshots/<screen>-light.webp` and `-dark.webp`, same filenames, both themes via the theme toggle, roughly the current 3024×1840 WebP format, same page and comparable data as the existing pair so the README gallery stays coherent. Then let the user decide whether to retake now or ship with the current ones — a slightly old screenshot is a smaller problem than a blocked release, and that trade-off is theirs.

## Step 7 — Run the quality gate

```sh
bun run typecheck
bun run test
bun run desktop:check-version v<X.Y.Z>
bun apps/desktop/scripts/release-notes.ts v<X.Y.Z>
```

Run these even though CI runs them too: finding a failure now costs a commit, finding it after the tag costs a deleted release. Report failures with their output rather than working around them.

## Step 8 — Commit, then stop before the tag

Commit the preparation on its own:

```sh
git commit -m "chore(release): v<X.Y.Z>"
```

Then stop and hand the user the two commands that actually publish:

```sh
git push
git tag v<X.Y.Z> && git push origin v<X.Y.Z>
```

Do not run them yourself unless the user explicitly asks in this conversation. Pushing the tag builds and publishes a public GitHub release with installers and an APK that people install over their existing one; that call belongs to the user. Mention that the build takes a while and that the release notes come from the changelog section, so it is worth re-reading before tagging.

## Final report

Close with a short summary the user can act on:

- version chosen, and why that bump
- files changed (version files, changelog, docs)
- changelog section, verbatim
- screenshots: up to date / to retake (which, why)
- quality gate: results
- the exact tag commands, and anything left deliberately undone
