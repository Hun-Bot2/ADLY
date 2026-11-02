# Company UI and desktop engine bridge (2026-10-29)

## Implemented

- The local service accepts `--api-only`, `--database`, `--catalog-root`, `--company-root`, and `--port`.
  API-only mode requires `APP_TOKEN` (32+ characters) and `APP_ORIGIN`. Every API request needs the token;
  CORS permits only the configured origin. Preflight is explicit. Writes require JSON and the configured
  origin; request bodies are capped at 2 MB. Research library/comparison paths are unavailable in API-only mode.
- `GET /api/health`; `POST /api/catalog/use`; `POST /api/local/daily-log/validate`; `POST /api/local/ingest`;
  `GET/POST /api/local/repositories`. Repository registration delegates to the existing engine ledger;
  shell code does not open the learner database.
- Company summary/detail APIs and a company preparation view: search, period, counts, small-list marker,
  focus selection, labelled general fill, per-level progress and estimated probabilities, concept progress,
  source provenance and explicit limitation on interpreting list membership. Company focus is validated
  against the active layer before preferences are written. Saving ordinary goals preserves company focus.
- Company mock creation uses a company/window/layer-bound immutable snapshot and the existing mock policy,
  with a 2-problem/45-minute default. Calendar history receives these snapshots through the journal.
  Scoped recommendations show company/window/version/source date/rank and general-fill labels.
- UI HTTP calls support `window.algorithmDesktop.connection()` returning `{url,token}`; browser development
  continues to use same-origin `/api`.
- `GET/PUT /api/local/contest-sync` controls opt-in, while-running daily contest sync, disabled by default.
  Attempt time is persisted before network activity; errors do not cause rapid retries. The manual sync
  button remains available. Settings persist in `contest-sync.json` beside the learner database, containing
  only enabled/last-attempt/last-success/error. No credentials are stored there.

## Executed validation

- `node --test hosted/test/local-desktop.test.mjs hosted/test/local.test.mjs`: 6/6 passed (socket-enabled).
  Synthetic tests cover token/origin/preflight, API-only isolation, preferences, company mock creation and
  repeat freeze, journal history, daily-log validation, temporary repository registration/ingestion, and
  contest scheduling/persistence.
- `node --test hosted/test/local-desktop.test.mjs hosted/test/ui-contract.test.mjs hosted/test/workspace-data.test.mjs`:
  35/35 passed before the additional scheduling-persistence test was added; API tests rerun afterward.
- `node hosted/workspace-browser-smoke.mjs`: three synthetic Chrome scenarios passed, with mocked providers.
- `node hosted/company-browser-smoke.mjs`: company list/progress/provenance, focus save, calendar company badge,
  mock creation, general reset, and missing-layer state passed in Chrome with no runtime exceptions.
  Screenshot inspected locally; synthetic artifacts are in the printed temporary output directory.

These are Node/Chrome development checks, not installed desktop, Windows, credential-store, signing or
release evidence. Native shell first-run copying, process supervision and installer checks remain separate.

## Desktop development UI end-to-end

`node desktop/browser-smoke.mjs` passed in Chrome using a temporary app-data directory, temporary
Git repository, authored problem metadata and the actual in-memory engine. Eleven checks cover the inherited
workspace, repository creation, recommendation-to-editor handoff, CodeMirror keyboard editing, draft restoration after reload, exact file
save, Python user test, daily-log recording, preview/commit of the selected two files, engine ingestion,
and return to the workspace. No browser runtime exceptions were observed; the screenshot was inspected.
The ingester emitted two observations (solution-path inference and the explicit daily-log row), consistent
with its existing source contracts; the receipt does not call those two independent solves.

Recommendation details and journal slots now show an editor action inside the desktop iframe (or when
a native `algorithmDesktop.openProblem` bridge is available). The handoff derives the ID from the exact
problem key and verifies the canonical platform HTTPS host. The parent validates message origin/source.
`node --test hosted/test/workspace-data.test.mjs`: 21/21 passed, including exact-ID handoff checks.

The final browser runs also cover the parent postMessage handoff. Backup export uses the same token-aware
HTTP client as other learner APIs, preserving native connection authentication. UI/workspace tests: 33/33 passed.
