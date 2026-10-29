# Company-wise LeetCode dataset: audit (2026-10-29)

Source: `https://github.com/liquidslr/leetcode-company-wise-problems`, commit `2b71796266751b4736a7ef180efb6847879166ee`
(2026-10-21, "Update Problem [Oct 20]"). The checkout was made in a temporary directory for this audit only. Nothing from the
dataset is stored in this repository; only aggregate counts are. Script: `audit_dataset.py`; receipt:
`receipts/dataset-audit.out`. Not legal advice.

## 1. Provenance and rights

| Item | Finding | Evidence |
|---|---|---|
| Licence | **None.** GitHub reports no licence; no LICENSE file | GitHub API `license: null`, `/license` 404 |
| Stated source | "based on the leetcode company tags" (repository description) | GitHub API |
| Collection method | Not documented | README |
| Upstream nature | LeetCode company tags and frequency are a LeetCode Premium feature | LeetCode product (not re-verified this session) |
| Popularity | 33.7k stars, 6.6k forks | GitHub API |

Implications (conservative):
- Without a licence, the author grants no redistribution rights beyond GitHub's own terms for viewing and forking on GitHub.
- The underlying lists appear derived from LeetCode Premium data. LeetCode's terms restrict scraping and reuse of their
  content (`research/full_catalog/terms-review.v1.json`, `specs/distribution-rights/`). A public repository does not
  transfer LeetCode's rights.
- Facts such as "company X asked problem Y" may be weakly protected by copyright, but contract (terms of service) and
  database rights remain unresolved, as for S11 in the distribution-rights report.
- Audit recommendation (2026-10-29): do not bundle or redistribute. **Superseded by user decision**: company metadata
  is built in (ADR 008, revised); these considerations are tracked in `specs/company-prep/distribution-considerations.md`.
  Upstream CSVs are still never committed to this repository.

## 2. Freshness

| Signal | Value |
|---|---|
| Latest commit | 2026-10-21 (Oct 20 update) |
| Earlier updates | 2026-08-16, 2026-06-26, 2025-06-20, 2025-06-01, 2025-05-13, ... (irregular; a 12-month gap) |
| README | "updated as of 1 June 2025" (stale) |
| Description | "Updated as of 20 Oct, 2025" (year inconsistent with the latest commit) |

Freshness must come from the pinned commit date, never from README text. Windows (30 days, 3 months, 6 months, more than
6 months) are relative to an unknown collection date.

## 3. Coverage and quality (pinned commit)

| Measure | Value |
|---|---|
| Companies | 470 (each has the five window files) |
| CSV files | 2,350; **1,227 are header-only** (30 days 422, 3 months 359, 6 months 297, >6 months 101, All 48) |
| Rows (all windows) | 36,347; malformed rows 0; duplicate problem within a file 0 |
| Unique problems | 3,396 (All files) |
| All-file difficulty | Easy 4,143, Medium 9,538, Hard 3,217 rows |
| Problems per company (All) | min 0, median 5, p90 51, max 2,324; **304 of 470 companies have fewer than 10** |
| Companies per problem | median 3, max 113; 1,019 problems belong to one company |
| Frequency | 5.0–100.0 per company list, median 37.5; scale and window semantics undocumented; not comparable across companies |
| Acceptance Rate | **All values 0.0013–0.0095** (Two Sum 0.0058; LeetCode shows about 0.5). The column is mis-scaled or mislabelled and is **unusable** |
| Topics | Present only in non-empty files; matches catalog-v4 native tags exactly for 83.5% of matched problems (median Jaccard 1.0) |
| Difficulty vs catalog-v4 | 1 disagreement among 2,794 matched problems |
| Matched to catalog-v4 | 2,794 of 3,396 (82.3%); 602 absent (paid-only at our January 2026 collection, newer, or renamed) |
| Catalog-v4 covered | 2,794 of 3,053 LeetCode rows (**91.5%**) |

Interpretation: "about 90% coverage" is the share of LeetCode that carries any company tag. Almost every problem is
tagged by some company, so membership alone is weak evidence of interview relevance. Frequency within one company's list
is the only ranking signal, and its meaning is undocumented.

## 4. Integration decision (ADR 008, revised 2026-10-29)

The user decided that company preparation is built in, with no manual import. The data is integrated as an immutable
company metadata layer keyed by existing catalog keys, built from a pinned commit, and shipped with the catalog. It
stores only company, window, catalog key, rank and frequency, plus unmatched slugs and provenance. Acceptance Rate and
topics are not stored. The 91.5% figure is reported as "share of our catalog found in company lists", never as
interview-question coverage. The licence and LeetCode-terms considerations of section 1 are tracked in
`specs/company-prep/distribution-considerations.md`; per the user, they do not block implementation.
