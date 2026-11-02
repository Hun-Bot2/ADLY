# New-user setup, GitHub sign-in and daily-log Code Workspace (2026-11-02)

Extends specs/desktop-app (DR-F18 ownership, DR-F23 missing Git). User request: treat the app as a new user would see it,
make GitHub sign-in work, and make the Code Workspace edit the daily Markdown logs the user already writes.

## Requirements

- NW-1 WHEN no repository is connected THE SYSTEM SHALL show a start panel whose first step is optional GitHub sign-in and
  whose second step connects a repository (local folder, GitHub repository, or new). Settings keeps the same controls.
- NW-2 GitHub sign-in SHALL use the device flow with a client ID built into the app (`ALDY_GITHUB_CLIENT_ID` at build time or
  the committed public file `desktop/src-tauri/github-client-id.txt`). A client ID is public; no client secret SHALL exist.
- NW-3 The device-code request SHALL ask for the `repo` scope so private solution repositories can be cloned and pushed.
- NW-4 The token SHALL stay in the OS credential store. The renderer SHALL receive only the account login and repository
  metadata (full name, HTTPS clone URL, private flag, update time), never the token.
- NW-5 WHEN signed in THE SYSTEM SHALL list the account's repositories for cloning and SHALL offer to create a new private
  repository; the new repository is created on GitHub, then a local repository is initialised with `origin` set to it.
  Nothing is pushed automatically (push remains explicit).
- NW-6 WHEN signed out or no client ID is built in, cloning by HTTPS URL and system Git credentials SHALL keep working.
- NW-7 The Code Workspace SHALL open today's log `<platform>/YY-MM-DD.md`, creating it from the repository's
  `templates/daily.md` when present (replacing `YYYY-MM-DD`), else from the built-in five-column table.
- NW-8 Opening a problem SHALL add one table row with the problem URL, an empty result and time, and review `0`, plus a
  `## <title>` section with the URL and an empty fenced code block, and SHALL place the cursor inside that block.
  An empty result creates no attempt (daily-log rules); the user fills the result in the file. A problem already in
  today's table SHALL NOT get a second row or section.
- NW-9 Run and tests on a Markdown file SHALL execute the fenced `python`/`py` or `cpp`/`c++` block that contains the
  cursor, else the nearest block above it. Other files run as before.
- NW-10 The app SHALL NOT add an attempt-recording form (AGENTS.md "VS Code-authored attempts"); results are typed in the file.

## Design

- Native shell (`auth.rs`): `github_repositories` (GET /user and /user/repos, owner+collaborator, sorted by update, 100 max)
  and `github_create_repository` (POST /user/repos, private by default, validated name). Both main-window only, behind the
  same origin check as auth commands, with User-Agent and API version headers. build.rs reads the client-ID file.
- Adapter (`dev.mjs`): `daily-open`, `daily-add` commands under the repository lock; `create` accepts an optional GitHub
  HTTPS `remote`; `run` accepts `line`. `open` (solution.py) stays for compatibility but the UI no longer calls it.
- `backend/dailylog.mjs`: `openDailyLog`, `addProblemToDaily` (column-aware: works with 3-, 4- and 5-column tables).
  `backend/runner.mjs`: `extractCodeBlock(markdown, line)`; runFile writes the block to its temporary run directory.
- Tradeoff: an OAuth App (not a GitHub App) is used because the `repo` scope covers any existing private repository without
  per-repository installation. Its client ID must be registered by the maintainer on github.com; the app cannot create it.

## Tasks

- [x] T1 Backend daily-log helpers and Markdown block extraction, with unit tests.
- [x] T2 Adapter commands and UI: today's log, add problem, run block; update IDE smoke.
- [x] T3 Native GitHub commands, scope, built-in client ID; cargo tests for name validation.
- [x] T4 Start panel step flow (sign in, repository list, create on GitHub); browser check with a mocked native bridge.
- [ ] T5 Rebuild ALDY.app; record what was and was not verified natively (live GitHub sign-in needs the registered client ID).
