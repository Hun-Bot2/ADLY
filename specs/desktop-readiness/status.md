# Desktop readiness: living baseline

Owner: documentation/review role. Last verified 2026-10-29 after F1–F5 implementation (iteration-3.md).
This file states what the code does today, separately from what a desktop release would need. It does not choose a
desktop framework or a visual design. Iteration reports: `iteration-N.md` (implementation) and `review-log.md` (review).

Evidence labels: **exec** = verified by execution in this checkout; **static** = read in source; **reported** = another
agent's claim, not re-run; **unverified** = nobody has checked.

## 1. Product definition

| Item | Current (evidence) | Proposed for desktop (not built) |
|---|---|---|
| Users | One learner, the repository owner (AGENTS.md "Current direction") | Other learners on Windows/macOS, authorized by the user desktop-product brief |
| Problem | Plan practice from one's own solution history across LeetCode, Codeforces, AtCoder, with explainable reasons | Same |
| Platforms | Apple Silicon Mac: macOS26.6.2 arm64, Node26.8.1 (exec) | macOS arm64 and Windows x64 release targets, Apple Silicon validated first; Intel Mac optional |
| Runtime deps | Node with built-in `node:sqlite`, system `git` on PATH, no npm runtime deps; `wrangler` dev-only (static: hosted/package.json) | Bundled runtime; system Git (DA-D3), Windows bundling measured in DA-W |
| Catalog | Immutable `catalog-vN.sqlite3` (catalog-v4: 265 MB file, 333 MB dir) built offline by Python + MiniLM under git-ignored `private-learning/` (exec: `ls -la`) | Shipped with the app with the company layer (ADR 008); rights tracked, not resolved (distribution-rights report, DC-5) |

### Capabilities that exist (static, current Node regression exec 254/254)

- Ingest committed Git history of registered local repos (`hosted/mastery/git-ingest.mjs`); local polling every 5 s while
  `hosted/local.mjs` runs (`git-sync.mjs`). No fetch/pull/clone: remote sync does not exist.
- Daily Markdown study logs, Schema-2 Markdown, commit trailers; solved/unsolved policy v3 (ADR 005).
- Journal, frozen daily `plan`, reviews, Easy → Medium → transfer → delayed review progression, weekly report, mock contest.
- Calendar workspace UI served on loopback (`127.0.0.1` host check, same-origin writes).
- Contest discovery (Codeforces, AtCoder, LeetCode community mirror) on explicit sync; network optional.
- Optional AI explanations (Gemini, NVIDIA) only via `explain`; separate SQLite ledger beside the learner DB.
- Backup v2 export/import of the learner DB (`hosted/backup.mjs`); excludes the explanation ledger and the catalog.

### Offline behavior (static)

Works offline: ingestion, planning, journal, calendar, backup. Needs network: contest sync, Codeforces rating sync,
`explain`. Missing catalog: contest fit reports insufficient evidence; planning commands fail with `catalog not found`.

## 2. Architecture as implemented

```text
 registered local Git repos ──git log (execFileSync, sync)──▶ git-ingest ─┐
 Markdown logs / CLI / browser forms ─────────────────────────────────────┤ append-only events + side ledgers
                                                                          ▼
 hosted/cli.mjs ─┐                                         learner SQLite (private-learning/hosted.sqlite3)
 hosted/local.mjs┴─ createDatabase (hosted/runtime/database.mjs): guarded migrations 001-008 on open
                    ledger.mjs → planner/progression/reviews (policy v3) ◀── ATTACH read-only catalog-vN.sqlite3
 local.mjs HTTP (loopback) ─▶ hosted/public/* (static allowlist)    explanations.mjs ─▶ Gemini / NVIDIA (opt-in)
```

Process boundary today: one Node process per entry point (CLI or local server); both can open the same DB file
(5 s busy timeout, `BEGIN IMMEDIATE`). `hosted/worker.mjs` (Cloudflare) remains in the tree as an optional path and must
not import Node-only modules. Specs: mastery-system/design.md (engine), ADR 003 (local SQLite canonical).

## 3. Desktop readiness tracker

| Area | State | Evidence | Gate |
|---|---|---|---|
| Path handling | F1–F3 fixed; special-character path fixtures pass on macOS | exec, iteration-3 | Apple Silicon runtime verified; Windows validation deferred |
| Data location | Repo-relative `private-learning/`; no per-OS app-data contract | static | DR-F16, task DA-1 |
| Migrations | SQLite pre-migration snapshot; rejects newer schemas and receipt drift | exec, migration tests | Stop concurrent writers before upgrade; see data-safety.md |
| Git dependency | Requires `git` on PATH; sync subprocess, 256 MiB buffer | static | DA-D3, DR-F23 |
| Catalog distribution | Built privately; rights unresolved | distribution-rights report | Tracked (DC-5); user review in DA-9 |
| AI providers | NVIDIA trial terms forbid giving outputs to others; Gemini free tier age/EEA limits | distribution-rights report | Off by default in any distributed build |
| Windows | Release target (final scope 2026-10-29); not yet executed | unverified | DA-0, DA-W CI, DA-9 |
| Installer size/memory | Not measured | unverified | DA-0 measurements |
| Auto-update | Specified, not built (DR-F22) | — | DA-7 |
| Authentication | None today; remote sync and GitHub sign-in specified, not built (DR-F10–F12) | static | DA-5, DA-6 |
| `node:sqlite` in packaged runtime | Unknown for Electron/Tauri-sidecar Node versions | unverified | DA-0 hard gate |

### Release requirements (DR-1/DR-3 specified in data-safety.md)

Superseded for the desktop app by `specs/desktop-app/requirements.md`: DR-1 → DR-F16, DR-2 → DR-F20, DR-3 → DR-F22,
DR-4 → DR-F21, DR-5 → DR-F23. Kept here for traceability.


- DR-1: THE SYSTEM SHALL store learner data in a per-user OS data directory and SHALL NOT write inside the install directory.
- DR-2: WHEN a path contains spaces, non-ASCII, `#`, `%` or a Windows drive letter, THE SYSTEM SHALL open the DB,
  catalog and entry points correctly (tested on both OSes).
- DR-3: WHEN pending migrations exist, THE SYSTEM SHALL back up the learner DB first; WHEN the DB has a migration newer
  than the app knows, THE SYSTEM SHALL refuse to write.
- DR-4: A distributed build SHALL NOT contain `private-learning/`, statements, or AI-provider credentials, and AI
  explanation SHALL be off until the user configures a provider.
- DR-5: WHEN `git` is missing, THE SYSTEM SHALL report it and keep all non-Git features working.

## 4. UX journeys to review before visual design

Listed only; none is designed. Onboarding (pick data folder, catalog), connect a local solution repo (and later a
GitHub remote), daily learning loop (journal → solve → log → refreshed plan), sync status and errors (`/api/local/sync`
already exposes `lastError`, `lastWarnings`), analytics and recommendation evidence, settings (timezone fixed to
Asia/Seoul today), empty/loading/offline states (missing catalog, missing Git, no network).

## 5. Open decisions

Resolved by the final scope (2026-10-29) unless noted.

- D1 Audience: resolved, distribution to other learners (ADR 007 context; AGENTS.md updated).
- D2 Desktop shell: open until DA-0. ADR 007 rule: Tauri + Rust backend + Node sidecar if every hard gate passes on both OSes,
  otherwise Electron.
- D3 GitHub authentication: approved as optional (DR-F10–F12, `specs/desktop-app/`); system Git credentials first, in-app
  sign-in later (DA-D4).
- D4 Git: system `git` CLI recommended (DA-D3); bundling revisited for Windows.
- D5 Auto-update and rollback: specified (DR-F22, design §8); built in DA-7.
- D6 Catalog: shipped with the app together with the company layer (ADR 008); rights tracked as DC-5, reviewed by the user in DA-9.

## 6. Documentation inventory (2026-10-29)

| Class | Documents |
|---|---|
| Accurate, retained | AGENTS.md (direction, gotchas); specs/mastery-system, mastery-journal, calendar-workspace, mock-contest, contest-discovery, recommendation-explanations, adaptive-progression; ADR 001-008; specs/distribution-rights |
| Governing the desktop work (2026-10-29) | specs/desktop-app (requirements, design, ordered tasks), specs/company-prep, ADR 007, ADR 008, research/company_prep/REPORT.md |
| Accurate, needs consolidation | specs/mastery-system/runbook.md and mastery-journal/runbook.md overlap (both are command references); merge when the desktop onboarding is specified |
| Outdated, corrected now | ReadME.md top section (assisted/independent wording after ADR 005; "no paid API" vs optional explanations); RECOMMENDATION_ENGINE/ (pre-policy-v3 audit, banner added) |
| Historical, keep as is | ReadME.md lower half, STAR.md, specs/production-recommender, specs/adaptive-learning deployment/oci/notifications (superseded by ADR 003), research/* reports |
| Redundant, removable | None proven; nothing deleted |
| Missing | App-data/migration contract (DR-1, DR-3), desktop ADR (D1, D2), UX journey spec (section 4), Windows test evidence |

`docs/` is git-ignored: never put governing documents there.

## Implementation follow-up (2026-10-29)

See iteration-3.md: F1–F5 implemented, including pre-migration snapshots and runtime adapter ownership. Windows remains unverified. D1 audience is resolved by the user desktop-product instruction.

## Platform priority correction (2026-10-29)

User uses Apple Silicon, not Intel. Priority: validate current Apple Silicon Mac first, Windows afterward. Intel macOS is optional feasibility scope and is not a gate for the current Mac milestone. Already executed on this Mac: Node286/286, Python74/74, Chrome synthetic workspace3/3 (progression-v2 validation receipts). Installer launch, bundling, signing/notarization and installed user-data behavior remain unverified because a desktop framework/package has not been selected; runtime/browser tests do not prove these.

## Target product scope (2026-10-29, final)

Desktop migration and extension of the existing app on macOS and Windows: all current features are inherited, plus an
editor, local run/tests, Git management with manual push, GitHub sign-in and remote sync, contest sync, and built-in company
preparation (no import). Specs: `specs/desktop-app/` (requirements, design, ordered tasks CP-1…DA-9), `specs/company-prep/`;
ADR 007 (shell decided by the DA-0 rule; engine kept; SQLite kept; ownership table), ADR 008 (company metadata layer).
Windows is a release target; Apple Silicon is validated first. Nothing of the new scope is implemented yet; the capability
list above remains the statement of what exists.
