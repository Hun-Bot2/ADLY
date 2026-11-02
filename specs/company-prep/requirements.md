# Company-specific preparation: requirements

Status: accepted 2026-10-29 (ADR 008, revised). Builder, engine integration and local UI implemented and fixture-tested; installed distribution remains gated. Tasks: `specs/desktop-app/tasks.md` (CP-1…CP-4).
Evidence: `research/company_prep/REPORT.md`. Distribution considerations: `distribution-considerations.md` (non-blocking).
(P) = provisional default, shown and never called optimised.

## Data layer

- CR1 THE SYSTEM SHALL provide company metadata as an immutable, versioned SQLite layer (`company-vN.sqlite3` + receipt)
  built from a pinned upstream commit and keyed by existing canonical catalog keys. It SHALL NOT duplicate problem
  records or modify any catalog version.
- CR2 The build SHALL match links by normalized URL (`https://leetcode.com/problems/<slug>`, lower-case, no trailing slash,
  no query or fragment) and then catalog aliases. Unmatched slugs SHALL be stored as unmatched and never recommended.
- CR3 The build SHALL treat header-only files as empty, accept the header with and without `Topics`, report malformed
  rows, never store Acceptance Rate, store Frequency only with its within-list rank, and report difficulty disagreements
  (catalog wins).
- CR4 The layer SHALL record: upstream URL, commit, commit date, build time, builder version, catalog version and SHA-256,
  per-file SHA-256, and the match report (companies, matched, unmatched, empty files, disagreements).
- CR5 THE SYSTEM SHALL select the newest shipped layer whose `catalog_version` equals the active catalog, verify its hash
  against the receipt, and attach it read-only. With no compatible layer, company features SHALL show "company data not
  available for this catalog version"; all other features SHALL work.
- CR6 Company features SHALL require no import, download or setup, and SHALL work offline.

## Recommendations

- CR7 Company preparation SHALL reuse progression-v2 estimates, readiness, follow-up and reviews. No company-specific
  ability SHALL be estimated, and general (non-company) outputs SHALL stay byte-identical.
- CR8 WHEN the learner selects a company focus (company, window), LeetCode candidates SHALL come from that list. Within
  evidence-equivalent candidates the order SHALL be: coverage gain, then rank, then concept purity, then the seeded hash (P).
- CR9 Concept focus SHALL add `company_share` = (matched list problems with the concept / matched list size) / largest
  share, weight 0.3 (P), shown in the explanation.
- CR10 An action with no list candidate SHALL report `insufficient_company_coverage`. With `fill_from_general` (default on
  (P)) a general candidate MAY be shown, labelled "not in <company> list".
- CR11 Codeforces/AtCoder transfer actions SHALL be off in company focus.
- CR12 Company mock interviews SHALL reuse the mock-contest composition restricted to unattempted list problems
  (default 2 problems / 45 minutes (P), adjustable) and store them as their own snapshot kind.
- CR13 Every company recommendation SHALL show the company, window, layer version and upstream commit date, the rank in
  the list, and the statement that list membership does not mean the problem will be asked.
- CR14 The company view SHALL show, per company: matched and unmatched counts, attempted and solved by difficulty, concept
  coverage, and the mean estimated solve probability of unattempted matched problems per level (labelled an estimate).
- CR15 The match rate SHALL be described as "share of our catalog found in company lists", never as interview coverage.
- CR16 The company focus SHALL be a learning preference stored in SQLite (`preferences.mastery.company_focus`, default
  none) and SHALL be included in backups.
