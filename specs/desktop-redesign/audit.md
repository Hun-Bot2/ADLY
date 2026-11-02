# Desktop redesign audit (2026-10-29)

## Actual stack and skill discovery

The learning frontend is plain browser ES modules with direct DOM rendering, not React/Vue. `hosted/public/app.mjs`
holds fetched state, local pending-write queues and dispatch; `workspace.mjs` owns in-memory calendar/history/analytics/
contest/research views; `workspace-data.mjs` contains presentation projections. CSS is a large shared stylesheet.
Company UI is another DOM module. There is no router library or central UI framework. Native desktop embeds the learning
page in an iframe and separately bundles CodeMirror6 through esbuild. Tauri launches external Node and the loopback
adapter. Tokens, origin checks, owned process limits and read-only catalog attachments are existing security boundaries.

No applicable Codex frontend-design/design-system skill was installed. The existing Claude official-marketplace
`frontend-design/SKILL.md` was found locally and read. It emphasizes deliberate production UI and cohesive execution.
The user's fixed fonts, monochrome editorial palette and dense workflow requirements supersede decorative examples.
No skill was fetched. `check.png` was inspected as supplied evidence, not adopted as a literal target or source of data.

## Route audit

| Current screen | Evidence/problem | Migration |
|---|---|---|
| Calendar/default | Full day cards precede calendar; monthly charts duplicate Analytics; calendar far below fold | Dedicated side-by-side month/week and selected-day panel |
| Journal/Today/tools | Overlapping plan summaries and tall forms; important timers/backup/preferences must survive | Compact Dashboard actions; secondary settings/tools |
| History | Separate nav despite date/detail duplication; actual search/edit/corrections useful | Explorer records tab, calendar/day and problem details |
| Analytics | Oversized cards, repeated descriptions and scattered small charts | Dense aligned charts and selectable real-record drilldown |
| Contests | Upcoming and ongoing combined; large date groups/rows | Three temporal tabs, compact columns, details and sources |
| Company | Large controls and provenance cards, raw topic paragraphs, long unstructured problems | Search pane, coverage tables, selected-company detail and mock action |
| Similarity + Library | Separate navigation; direct proxy/library requests, meaningful provenance limits | Unified Research sub-tabs, retain evidence and sources |
| Desktop tools | Outer tabs duplicate inner sidebar; vertical forms, always-visible auth and repo configuration | One 8-item shell, IDE panes, configuration drawer |
| Native onboarding | Recently fixed owned window/close cancellation | Preserve; apply typography/surface alignment only if needed |

## Data and preservation

Actual attempts, corrected records, frozen plans, review queues and contest caches already exist. Durations can be absent,
manual minutes/seconds can overlap confirmed timers, and plans are not attempts. Company APIs distinguish matches,
unmatched source metadata, historical observations and uncalibrated estimates. Similarity/research proxies may be
unavailable and must not become invented results. No policy/ranking, schema, ingestion format, data, secrets or permissions
are removed. Full-catalog Explorer needs a bounded local read-only API; no statement content will be read or exposed.

## Validation inventory

Existing Node engine/policy/backup/Git/API tests; workspace-data/UI contracts and Chrome smokes; CodeMirror/desktop browser
flow; Tauri unit tests, packaging audit and native onboarding smoke. Old tests asserting calendar default/history nav must
be updated to the new product IA, while preserving actual capabilities and security assertions. Existing user work is
already dirty and will be retained. All mutation tests use temporary learners/repos, never the real learner database.
