# LeetCode statement research: requirements

Status: accepted by the user (2026-11-03). Private research only; nothing here changes app recommendations.

## Decisions (user, 2026-11-03)

- D-1 Re-collect LeetCode statements for the user's own research. This supersedes, for LeetCode only, the 2026-10-16 decision to
  skip statement collection (research/full_catalog/terms-review.v1.json stays byte-identical as history). The terms text and
  robots.txt are unchanged; the user accepts that risk for private, non-redistributed research.
- D-2 The user runs the per-problem statement fetch in their own terminal. The agent provides the command and does not run it.
- D-3 Representations: R0 tags only (baseline; no random baseline), R1 tags + difficulty, R2 tags + title, R3 tags + statement,
  R4 tags + difficulty + statement. Title use is research only (memory: no title embeddings in matching or recommendation).
- D-4 Order: snapshot refresh, then study 2 (within LeetCode), then study 1 (cross-platform).
- D-5 Study 1 waits for the user: a tag-name mapping across platforms, whether AtCoder (mostly untagged) is compared at all, and how
  Codeforces ratings map to Easy/Medium/Hard. Nothing is guessed before the user's answer.

## Snapshot (step 0)

- LS-1 THE SYSTEM SHALL write a new versioned snapshot under `private-learning/leetcode-snapshots/<version>/`, never modifying the
  asset-pinned `data/raw/leetcode_raw_data.jsonl` or `data/processed/*`.
- LS-2 Phase `list` SHALL record every problem's metadata (frontend id, title, slug, difficulty, paid-only flag, tag names and slugs).
  Phase `content` SHALL fetch each non-paid problem's statement once, one request at a time, with at least 2 s between requests.
- LS-3 The fetch SHALL be resumable and idempotent: a rerun skips slugs already stored, and an interrupted run loses at most the
  request in flight. Rows are appended (JSONL) and never rewritten.
- LS-4 Paid-only problems, missing content and request errors SHALL be recorded as such (`content: null` with a reason), never
  filled from another source or the old snapshot.
- LS-5 Each phase SHALL write a receipt (counts, sha256 of outputs, start/end time, errors) next to the data. Outputs and receipts
  stay private; only aggregate counts may be quoted in committed reports.
- LS-6 The fetcher SHALL send no credentials or cookies and SHALL stop after a bounded number of consecutive errors.

## Study 2: within LeetCode (first)

- LS-7 For each representation R0-R4 THE SYSTEM SHALL produce neighbors (top-k), a 2D map and summary numbers from the same row set.
- LS-8 Rows SHALL be the problems present in every compared representation (paid-only rows without a statement are excluded from
  R3/R4 comparisons and the exclusion count is reported).
- LS-9 Results SHALL report, per representation: neighbor overlap with R0, how often same-tag-set groups split by statement, and
  pairs with different tags but near-identical statements. Tag agreement SHALL NOT be used as the quality score of a tag-based
  representation (circular).
- LS-10 Statement text SHALL be cleaned from HTML deterministically; the embedding model is the pinned local MiniLM with its token
  limit disclosed (statements are longer than titles; truncation is reported, not hidden).

## Study 1: cross-platform (after D-5)

- LS-11 Uses Codeforces/AtCoder statements already admitted (CodeContests, private) and the existing 3,647 AI-reviewed pairs as a
  reference only (not gold).
