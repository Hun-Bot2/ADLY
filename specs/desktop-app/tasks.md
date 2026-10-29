# Desktop app and company preparation: ordered tasks (Codex handoff)

Supersedes the earlier folder-import-first task list (2026-10-29). Execute in order and tick the Done box when a task's acceptance evidence is recorded; a task starts only when its
dependencies are done and their evidence is recorded (commit message or `specs/desktop-readiness/iteration-N.md`).

## Global rules

- Migration, not rewrite: do not change progression-v2 outputs, the daily Markdown format, ledgers, migrations 001–008 or
  backup formats unless a task says so. These must stay green after every task:
  - `node --test hosted/test/*.test.mjs` (existing suite, unchanged)
  - the v1/v2 journal snapshot byte-identity tests
  - from DA-1 on, the shell test suite (`cargo test --manifest-path desktop/src-tauri/Cargo.toml`, or the Electron equivalent)
- Tests use synthetic learners, temporary repositories, temporary app-data directories and authored fixtures. Never the
  real learner DB, the user's solution repository or the upstream company data in committed fixtures.
- Never commit learner data, statements, credentials or upstream company CSVs. Committed company artefacts are receipts only.
- Every new path-handling test includes spaces, non-ASCII, `#`, `%` and (on Windows) drive letters and long paths.
- Ownership per ADR 007: the engine is the only learner-DB writer; the shell owns repository writes, processes and credentials.

## Order

| Done | # | Task | Depends on | Parallel with |
|---|---|---|---|---|
| [ ] | 1 | CP-1 Company layer builder | — | DA-0 |
| [ ] | 2 | DA-0 Shell spike and decision (macOS + Windows) | — | CP-1 |
| [ ] | 3 | DA-W Cross-platform CI | DA-0 | CP-2 |
| [ ] | 4 | CP-2 Company layer loading and progression scope | CP-1 | DA-W, DA-1 |
| [ ] | 5 | DA-1 App foundation (supervisor, app data, token, bundled UI, first-run copy) | DA-0 | CP-2 |
| [ ] | 6 | CP-3 Company views and mock interviews in the UI | CP-2, DA-1 | DA-2 |
| [ ] | 7 | DA-2 Repository management and editor | DA-1 | CP-3 |
| [ ] | 8 | DA-3 Runner and tests (macOS + Windows) | DA-2 | DA-4 |
| [ ] | 9 | DA-4 Record result and commit | DA-2 | DA-3 |
| [ ] | 10 | DA-5 Remote sync with system credentials, manual push | DA-4 | — |
| [ ] | 11 | DA-6 GitHub sign-in (device flow, OS credential store) | DA-5 (+ GitHub App client id from the user) | DA-8a |
| [ ] | 12 | DA-8a Contest periodic sync setting | DA-1 | DA-6 |
| [ ] | 13 | DA-7 Packaging, signing, updates (macOS + Windows) | all above | — |
| [ ] | 14 | DA-9 Release validation (both OS) | DA-7 | — |

---

**CP-1 Company layer builder** (company-prep CR1–CR4)
Files: `research/company_prep/build_company_layer.py`, `research/company_prep/test_build_company_layer.py`, authored
fixtures under `research/company_prep/fixtures/`.
Accept: the fixture build covers both headers, header-only files, a malformed row, URL normalisation (trailing slash, query,
upper case), an alias, an unmatched slug and a difficulty disagreement (catalog wins). No Acceptance Rate or topics stored.
Idempotent output (same SHA-256); refuses to overwrite; verifies the catalog hash and the upstream `HEAD`. Real build
(local, not in CI) at commit `2b717962…` against catalog-v4 writes `private-learning/mastery/company-v1/`. The committed
receipt reproduces the audit: 470 companies, 3,396 slugs, 2,794 matched, 602 unmatched, 1,227 empty files, 1 difficulty
disagreement. Run: `python3 -m unittest discover -s research/company_prep -v`.

**DA-0 Shell spike and decision** (ADR 007 rule)
Build minimal Tauri and Electron shells that run the existing engine (`hosted/local.mjs`) and UI with the real catalog,
the company layer and a synthetic learner on Apple Silicon macOS and Windows x64.
Accept: `specs/desktop-readiness/da-0-measurements.md` records, per shell and OS: the hard gates (`node:sqlite` in the packaged
runtime; no orphans after quit, crash and restart, checked with `ps`/Task Manager; datasets attach from app data; OS
credential store write/read/delete; signing feasibility) plus the measured installer size, installed size, idle memory
(all processes, 60 s) and cold start to the first `/api/journal` response. Apply the rule and write the choice into ADR 007
status. If a hard gate fails on one OS only, record it and stop for the user.

**DA-W Cross-platform CI**
Files: `.github/workflows/desktop-ci.yml` (macos-14, windows-latest).
Accept: runs the Node suite, the Python foundation tests, the shell tests and an unsigned package build on both OSes; no
secrets required; private data is never needed (tests use fixtures). Report the first green run.

**CP-2 Company layer loading and progression scope** (CR5–CR12, CR16)
Files: `hosted/mastery/company.mjs`, `core/preferences.mjs` (additive `company_focus`), `progression-v2.mjs` (`scope`),
`journal-v2.mjs` (scope in the snapshot key, `company_mock` filtered from plan iteration), `mock-contest.mjs` (`restrictTo`), tests.
Accept: automatic selection of the newest layer for the active catalog with hash verification; no compatible layer means
company features are unavailable with the message, and all else works; without a focus, outputs are byte-identical; with a
focus: LeetCode candidates only from the list; tie-break coverage → rank → purity → hash (fixture where rank decides);
`company_share` 0.3 shown; `insufficient_company_coverage` and the labelled fill-from-general candidate; no transfer;
unmatched slugs never recommended; the company mock uses unattempted list problems, 2 / 45 min default; backups include
`company_focus`; older-reader reload gotcha honoured.

**DA-1 App foundation** (DR-I1, DR-I3, DR-F16–F20, DR-F23)
Files: shell `sidecar`/`paths`/`settings` modules; `hosted/local.mjs` `--api-only`, token, CORS, `/api/health`,
`/api/catalog/use`, root arguments; UI bundled into the shell.
Accept: the app-data layout is created per OS; first-run copy of `private-learning/hosted.sqlite3`, the catalog and the
company layer only after confirmation, with source hashes unchanged (test); bundled datasets are copied and verified on a
fresh install; 403 without the token and 200 with it; killed-engine restart and a "reconnecting" UI; quit leaves no
process (both OS); missing `git` gives the DR-F23 message; DR-I3 snapshot identity against `node hosted/local.mjs`; every
inherited view in requirements §2 opens and loads in a smoke test.

**CP-3 Company views and mock interviews** (CR13–CR15)
Files: UI company view, focus selector, badges on journal/calendar, `/api/company*`.
Accept: UI contract tests: the company list with matched counts per window and a small-list marker; the provenance text and
the CR15 wording (no "coverage of interview questions"); progress with estimates labelled; the scoped recommendation shows
CR13 fields; company mock creation and history; works offline.

**DA-2 Repository management and editor** (DR-F1–F3)
Files: shell `repo` module; editor views (CodeMirror 6); `desktop/templates/` (project-authored).
Accept: register, create with the layout, clone (local bare remote in tests); traversal, symlink, UNC and short-name escapes
rejected; "Open in editor" from a recommendation creates the file without overwriting; drafts survive a forced quit;
templates contain no statements, examples or official signatures (review checklist).

**DA-3 Runner and tests** (DR-F4–F6)
Files: shell `runner` module; Run/Tests view; `tests.json` schema.
Accept on both OSes: Python and C++ fixtures for pass, wrong answer, compile error, runtime error, infinite loop (killed,
no surviving descendants), output flood (capped), a child that outlives its parent (killed via group/Job); the three
comparison modes; a missing toolchain message; a Windows memory-limit fixture enforced; the macOS memory-limit behaviour
recorded and shown.

**DA-4 Record result and commit** (DR-F7–F9)
Files: shell `dailylog` and `git` modules; `/api/local/daily-log/validate`, `/api/local/ingest`; Record & Commit view.
Accept: appends to fixture logs (the template, existing rows, trailing sections, CRLF, no trailing newline) change only
the inserted row (byte diff); the result passes `parseDailyLog` with no new flags; a missing dated file is created from the
template; commit stages only the listed paths; refuses on conflict, detached HEAD or index lock; a ban-list grep test
passes; after commit, ingestion records the attempt and the journal refreshes (integration test in a temp repo).

**DA-5 Remote sync and manual push** (DR-F10–F11)
Accept against a local bare remote: up to date; behind → ff and ingestion; ahead → manual push; diverged → stop with
unchanged refs (hash check); push rejected → error; a remote force-push is never pulled; off by default; works with
system credentials (an SSH and an HTTPS fixture where CI allows *verify*).

**DA-6 GitHub sign-in** (DR-F12)
Accept: device flow against a mock server (success, denial, expiry, slow_down); the token only in the OS store (fake in
tests, real store in the per-OS smoke); a scan proves its absence from logs, the DB, backups, `.git/config`, `state.json` and
process arguments; `GIT_ASKPASS` helper used; sign-out deletes it; fallback to system credentials. Runbook: how the user
registers the GitHub App (permissions: contents read/write on selected repositories).

**DA-8a Contest periodic sync**
Accept: an opt-in setting (default off) syncs at most daily while the app runs and online, shows the last-sync time and
errors, and uses the existing provider rules; the explicit sync button is unchanged.

**DA-7 Packaging, signing, updates** (DR-F21–F22)
Accept: signed and notarized macOS arm64 build, and an Authenticode-signed Windows x64 installer (or a recorded blocker per
missing certificate); a bundle-content script proves no learner data, statements, credentials, research files or upstream
CSVs (only the catalog and company layers); fresh install and upgrade from the previous build keep data (pre-migration
snapshot present, newer-schema refusal tested); update channel signed.

**DA-9 Release validation**
Accept: on a clean macOS arm64 machine and a clean Windows x64 machine: the full end-to-end smoke (journal → open problem →
run tests → record → commit → refreshed recommendation → company focus → mock interview → contest sync → backup/restore)
with screenshots; Node suite and receipts reproduce; the distribution considerations register reviewed by the user.
