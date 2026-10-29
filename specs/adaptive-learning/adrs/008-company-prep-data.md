# ADR 008: Company metadata integrated into the existing catalog

Status: accepted (user decision), 2026-10-29. **Supersedes** the earlier same-day version of this ADR, which allowed only
a personal folder import. Evidence: `research/company_prep/REPORT.md`. Spec: `specs/company-prep/`. Distribution
considerations are tracked separately in `specs/company-prep/distribution-considerations.md` and do not block implementation
(user decision).

## Context

The user decided that company preparation must work out of the box: no CSV import and no manual setup, and no duplicate
problems or catalog rebuild. The source is `liquidslr/leetcode-company-wise-problems`. Audit at commit
`2b71796266751b4736a7ef180efb6847879166ee` (2026-10-21):
- 470 companies, 3,396 problems.
- 2,794 problems match catalog-v4 LeetCode records (91.5% of the catalog); 602 are absent from the catalog.
- 52% of files are header-only; the median company has 5 problems.
- Acceptance Rate is invalid; Frequency is an order within one list.
- No licence; the repository describes itself as derived from LeetCode company tags.

## Decision

1. Build an immutable, versioned **company metadata layer** (`company-vN.sqlite3` plus a receipt) from a pinned upstream
   commit. It is keyed by the existing canonical catalog keys (`leetcode:<slug>`, aliases resolved). It contains only
   company, window, catalog key, rank and frequency, plus unmatched slugs and provenance. Problem records are never copied
   or rebuilt.
2. The app ships the layer with the catalog and attaches it read-only. The active version is selected automatically: the
   newest bundled version built for the active catalog version. No user setup is needed.
3. Matching uses normalized URLs: lower-case, scheme and host `leetcode.com`, path `/problems/<slug>`, trailing slash and
   query removed, then catalog aliases. Unmatched slugs are stored as unmatched and never recommended.
4. Data quality rules: Acceptance Rate is not stored; Frequency is used only as an ordinal within one (company, window)
   list; topics are not stored (catalog tags are authoritative); difficulty disagreements are reported, and the catalog wins.
5. Provenance is kept and shown: upstream URL, commit, commit date, build time, parser version, catalog version, file
   hashes and match report. The UI states the match rate as "share of our catalog that appears in some company list".
   It is never presented as coverage of real interview questions, and it states that list membership does not mean a
   problem will be asked.
6. Updating means a new layer version from a newer pinned commit, built and reviewed like a catalog version. The app
   never fetches upstream at runtime.
7. Company preparation reuses progression-v2 and the mock-contest composition (company-prep design).

## Rejected

- A manual CSV or folder import as the primary path (user decision: no manual setup).
- Duplicating problems or rebuilding the catalog with company columns (catalog versions stay immutable; the join is by key).
- Runtime fetching from GitHub (no network dependence; reproducible versions).
- Using Acceptance Rate or cross-company Frequency (invalid or undocumented).

## Consequences

- No licence was found and the upstream lists derive from LeetCode company tags. These distribution considerations are
  recorded in the register and remain open; they are not resolved by this ADR.
- A catalog version change requires a rebuilt company layer. Until one exists, company features show "company data not
  available for this catalog version".
