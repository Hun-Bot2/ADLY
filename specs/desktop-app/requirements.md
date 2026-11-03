# Desktop app: product scope and requirements

Status: accepted 2026-10-29 (final product decisions). Architecture: ADR 007. Recommendation core: ADR 006
(progression-v2). Company metadata: ADR 008. Baseline: `specs/desktop-readiness/status.md`, `data-safety.md`.
(P) = provisional default the user may change.

## 1. Principles

- **Migration and extension, not a rewrite.** Every existing feature is inherited with its data, formats, behaviour and tests.
- Local-first: everything except remote sync, contest sync, sign-in and optional AI explanations works offline.
- macOS (Apple Silicon first) and Windows x64 are both release targets. Intel macOS is optional.
- No mandatory account, paid service or telemetry. Solution code leaves the machine only through the user's push.

## 2. Inherited features (must keep working unchanged)

| Feature | Current implementation |
|---|---|
| Adaptive progression and recommendations, explanations | `hosted/mastery/progression-v2.mjs`, `journal-v2.mjs`, `explanations.mjs` |
| Dashboard, journal, calendar workspace, history, weekly report | `hosted/public/*`, `/api/journal`, `/api/state` |
| Reviews, 복습 targets, timers, manual attempts and corrections | `/api/events`, `/api/journal/attempt`, `reviews-v2.mjs` |
| Git ingestion of committed history (daily Markdown, trailers) | `git-ingest.mjs`, `daily-log.mjs`, `git-sync.mjs` |
| Contests (discovery, manual, participation) and mock contests | `/api/contests/*`, `/api/participation`, `mock-contest.mjs` |
| Preferences, backup/restore, export/import | `/api/preferences`, `/api/backup/*`, `/api/export`, `/api/import` |
| CLI (all commands) | `hosted/cli.mjs` (developer tool; not required in the installer) |
| Research library and comparison viewer | Development mode only (they read repository research files and a Python server) |

- DR-I1 Existing SQLite data SHALL open without modification beyond the existing guarded migrations; existing
  `private-learning/` data SHALL be copied (never moved) into the app-data directory on first run after confirmation.
- DR-I2 The daily Markdown format (`# YYYY-MM-DD`; `| 문제 | 결과 | 시간 | 복습 | 메모 |`) and all ingestion rules SHALL be unchanged.
- DR-I3 For identical ledger, catalog, preferences, date and code, recommendation snapshots SHALL be byte-identical
  between `node hosted/local.mjs` and the packaged app.
- DR-I4 The existing Node regression suite SHALL pass unchanged in CI on macOS and Windows.

## 3. New features

| ID | Feature |
|---|---|
| F1 | Repository management: register, create with the standard layout, clone from GitHub |
| F2 | Integrated code editor |
| F3 | Local execution and user-authored tests |
| F4 | Record a result into the daily Markdown log |
| F5 | Commit and optional manual push |
| F6 | GitHub sign-in and remote synchronisation |
| F7 | Contest synchronisation (explicit + opt-in periodic) and personalised mock contests (existing, kept) |
| F8 | Company-specific preparation, built in (`specs/company-prep/`) |
| F9 | Installers, secure credential storage and updates on macOS and Windows |

## 4. Requirements

Repository and editor
- DR-F1 THE SYSTEM SHALL register an existing local repository, create one with `leetcode/`, `codeforces/`, `atcoder/`
  folders and `templates/daily.md`, or clone a GitHub repository into a user-chosen folder.
- DR-F2 Opening a problem SHALL create (never overwrite) `<platform>/<id>/solution.<ext>` from a project-authored
  template, with the problem link. No statements, examples or official function signatures SHALL be included.
- DR-F3 Unsaved editor content SHALL survive a crash (drafts in app data); repository files change only on explicit save.

Execution and tests
- DR-F4 THE SYSTEM SHALL run the current file with stdin, and with user-authored tests in `<problem dir>/tests.json`
  (input, expected output, comparison: exact, whitespace, float tolerance).
- DR-F5 (UI removed 2026-11-03, see new-user-workspace.md NW-11; backend only) Every run SHALL have a wall-clock timeout (5 s (P)), a CPU limit, a 1 MiB output cap and kill of the whole process
  tree: a process group on macOS, a Job Object on Windows. Memory limits: a Job Object limit on Windows; on macOS only
  where enforced, otherwise the UI says "memory limit not enforced". Runs use the user's permissions and are not a sandbox.
- DR-F6 Toolchains SHALL be detected, not bundled: Python 3 (`python3`, or `py -3` on Windows) and C++17 (`clang++`, `g++`, or
  MSVC `cl` on Windows) (P). A missing toolchain gives an actionable message.

Recording, commits, remote
- DR-F7 Recording SHALL append exactly one row `| <problem URL> | 1|0 | <time or blank> | 1|0 | <memo> |` to the table of
  `<folder>/YY-MM-DD.md` (default folder: the problem's platform folder, matching existing files; `daily/` optional),
  preserving all other bytes and the file's line endings; the file must parse with `daily-log.mjs` with no new flags.
- DR-F8 Time is what the user enters (an editor timer may prefill it, and the prefill must be confirmed); the memo is never evidence.
- DR-F9 Commit SHALL stage only the paths the app wrote or the user selected, show the diff, and never amend, rebase,
  reset, force or rewrite. Recommendations refresh from the local commit through existing ingestion.
- DR-F10 Push is manual (P). Remote sync is off until enabled. When enabled: fetch, fast-forward only, manual push.
  Divergence, rejection or missing credentials stop sync visibly with no local change.
- DR-F11 Remote commits affect recommendations only after a fast-forward into the local branch; the ingestion
  history-rewrite halt is preserved.
- DR-F12 Credentials: system Git credentials, or in-app GitHub sign-in (device flow; GitHub App limited to selected
  repositories (P)). The token is kept only in the OS store (macOS Keychain, Windows Credential Manager), handed to Git per
  invocation, and never written to files, logs, the database, backups, Git config or process arguments. Sign-out deletes it.

Contests, company, recommendations
- DR-F13 progression-v2 SHALL remain the only recommendation engine and SHALL NOT be ported.
- DR-F14 Contest sync: explicit, plus an opt-in periodic sync (daily (P)) with a visible last-sync time. Mock contests unchanged.
- DR-F15 Company preparation SHALL satisfy `specs/company-prep/requirements.md` with no setup.

Platform, data, security
- DR-F16 All app data SHALL live in the per-user app-data directory (macOS `~/Library/Application Support/<id>`, Windows
  `%APPDATA%\<id>`); the install directory is never written.
- DR-F17 The engine API SHALL require a per-launch token and accept only the app origin; the loopback host check stays.
- DR-F18 Ownership follows ADR 007: the engine is the only learner-DB writer; the shell owns repository writes, processes and credentials.
- DR-F19 Start, quit, sleep/wake and engine crashes SHALL leave no orphan processes and no partial writes; the engine restarts with backoff.
- DR-F20 Paths with spaces, non-ASCII characters, `#`, `%`, drive letters and long paths (Windows) SHALL work for the DB,
  catalog, company layer, repositories and runs.
- DR-F21 Builds SHALL be signed (Apple Developer ID plus notarization; Authenticode on Windows) or the blocker recorded. A
  bundle check SHALL prove no `private-learning/` learner data, statements, credentials or research files are included.
  The catalog and company layers are the only shipped datasets.
- DR-F22 Updates SHALL preserve data, take the pre-migration snapshot, and refuse newer schemas (data-safety.md).
- DR-F23 WHEN `git` is missing, Git features SHALL explain how to install it and every other feature SHALL work.
