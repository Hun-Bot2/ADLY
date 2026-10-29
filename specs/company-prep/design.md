# Company-specific preparation: design

Implements `requirements.md` (ADR 008). Replaces the earlier folder-import design: there is no user import path.

## 1. Build pipeline (development time, like catalog versions)

```text
research/company_prep/build_company_layer.py  (stdlib Python, run with -I)
  inputs : --upstream <checkout at pinned commit> --commit <sha> --catalog private-learning/mastery/catalog-vN/catalog-vN.sqlite3
  output : private-learning/mastery/company-vK/company-vK.sqlite3 + receipt.json   (refuses to overwrite)
  receipt: research/company_prep/receipts/company-vK.receipt.json (committed; aggregates and hashes only)
```

The builder verifies the catalog hash against its receipt and that the checkout `HEAD` equals `--commit`. It writes in a
single transaction and records `output_sha256`. Upstream data is never committed to this repository. The packaged app
includes the layer (DA-7).

Schema (`company-vK.sqlite3`):

```sql
CREATE TABLE company_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);           -- version, upstream_url, commit, commit_date,
                                                                                -- built_at, builder_version, catalog_version,
                                                                                -- catalog_sha256, report (JSON)
CREATE TABLE companies(company_id TEXT PRIMARY KEY, name TEXT NOT NULL);         -- id = lower-case slug of the folder name
CREATE TABLE company_problems(company_id TEXT NOT NULL REFERENCES companies, window TEXT NOT NULL
  CHECK (window IN ('30d','3m','6m','gt6m','all')), problem_key TEXT NOT NULL, rank INTEGER NOT NULL, frequency REAL,
  PRIMARY KEY(company_id, window, problem_key));
CREATE TABLE company_unmatched(company_id TEXT NOT NULL, window TEXT NOT NULL, slug TEXT NOT NULL, rank INTEGER NOT NULL,
  PRIMARY KEY(company_id, window, slug));
CREATE TABLE company_files(path TEXT PRIMARY KEY, sha256 TEXT NOT NULL, rows INTEGER NOT NULL, empty INTEGER NOT NULL);
```

`rank` is the row position in the source file (1 = first; the source orders by frequency). Window names map
`1. Thirty Days`→`30d`, `2. Three Months`→`3m`, `3. Six Months`→`6m`, `4. More Than Six Months`→`gt6m`, `5. All`→`all`.

## 2. Runtime loading (Node engine, read-only)

`hosted/mastery/company.mjs` (Node-only, beside `catalog.mjs`):
- `attachCompanyLayer(sqlite, root, catalog)`: picks the newest `company-v*` whose `catalog_version` equals
  `catalog.version`, verifies `output_sha256`, and attaches it read-only with the same URI-encoding helper as the catalog
  (`immutable=1`).
- `loadCompanyLists(sqlite)` returns `{version, meta, companies, lists: Map(company_id → Map(window → [{problem_key,rank}]))}`.
  The pure planner receives a plain object (Worker-safe), as it does with the catalog.

## 3. Company focus in progression-v2

`planProgressionV2({..., scope})`, `scope = {kind:'company', company_id, window, fill_from_general, list, layer_version}`:
- LeetCode action pools are intersected with the list; transfer actions are removed.
- Cell tie-break: coverage gain → rank → purity → FNV-1a(`learner|date|concept|key`).
- Concept focus adds `0.3 * company_share` (component `company_share`).
- Empty action → `insufficient_company_coverage`; with `fill_from_general`, the general candidate carries
  `scope_match:false` and the label.
- Snapshot key adds `company_id`, `window` and the layer SHA-256. Without a scope, everything is unchanged (byte-identity test).

The preference `mastery.company_focus = {company_id, window, fill_from_general}` is an additive key in
`core/preferences.mjs`. Validation: a known company in the active layer, a valid window, a boolean. Older readers must be
reloaded before writing it (existing AGENTS.md gotcha). The default is `null` (general progression).

Company mock interview: `candidatePool({..., restrictTo})` with the list keys; snapshot kind `company_mock`, which the
journal filters out of plan iteration like `mock_contest`; defaults of 2 problems / 45 minutes.

## 4. Views and API

- `GET /api/company` → layer meta, the company list with matched counts per window, small-list markers (< 10 matched), and
  the provenance text.
- `GET /api/company/:id?window=` → company progress (CR14).
- `PUT /api/preferences` carries `company_focus`. The journal and calendar show the company badge on scoped recommendations.
- Copy: "카탈로그 문제 중 회사 목록에 포함된 비율" for the match rate, plus the CR13 statement.

## 5. Defaults (provisional, change by user decision only)

| ID | Default |
|---|---|
| CP-D2 | Default window `all` (30d is empty for 422 of 470 companies) |
| CP-D3 | Rank before purity in tie-breaks |
| CP-D4 | `fill_from_general` on, labelled |
| CP-D5 | Company mock: 2 problems / 45 minutes |

## 6. Validation

- Builder: unit tests over **authored** fixture folders (both header variants, header-only, a malformed row, URL variants
  with a trailing slash, query or upper case, an alias, an unmatched slug, a difficulty disagreement). It must be idempotent
  for identical inputs (same SHA-256) and refuse to overwrite.
- Real build: run locally against the pinned commit; the committed receipt must reproduce the audit counts (470 companies,
  3,396 slugs, 2,794 matched to catalog-v4, 1,227 empty files).
- Engine: scope tests listed in CP-2 (desktop-app tasks); byte-identity without scope; no recommendation of unmatched slugs.
