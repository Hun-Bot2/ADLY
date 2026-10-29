# Distribution rights: research brief (2026-10-28)

Purpose: hand this to a research agent. It lists every place where copyright, database rights, terms of service,
licenses or trademarks may matter if this project is (a) kept as a public GitHub repository, (b) shipped as a
desktop app (dmg/exe), or (c) hosted as a web service. Facts below were checked in this repository on 2026-10-28.
Nothing here is legal advice, and the agent's output will not be legal advice either.

## Rules for the research agent

- Read terms, licenses, robots.txt and official FAQ/announcement pages only. Do not call LeetCode `/graphql` or
  `/api/`, do not crawl problem pages, do not download datasets or model weights.
- Never send learner data, API keys or files under `private-learning/` anywhere.
- For every claim, record: source URL, retrieval date, the exact clause (quote at most one or two short sentences),
  and whether the page shows an effective/revision date.
- Prior review to start from (do not repeat unless a page changed): `research/full_catalog/terms-review.v1.json`
  (T1-T8, 2026-10-16), `research/statements/acquisition-review.v2.json`,
  `research/algorithm_system/CHECKPOINT2.md` (scoped decision on publisher datasets).

## Expected output

One table per item below, with a verdict for each mode: `personal local use`, `public repo`, `desktop distribution`,
`web hosting`. Use one of: allowed, allowed with conditions (list them), unclear (what would settle it), not allowed.
Then a short list of remediation options per item, ordered by effort.

## P0: content that is already public

The GitHub repository `Hun-Bot2/Algorithm-RAG-Engine` is PUBLIC.

1. **Problem statements in public git history.** Commits from 2025-12-30 (`4c5f016`, `0b14a05`, `0faa583`,
   `cdb02e8`) added root-level `leetcode_raw_data.jsonl` (100 rows, `content` field, avg 1,565 chars),
   `leetcode_preprocessed.jsonl`, `baekjoon_raw_data.jsonl` (100 rows, `content`) and `baekjoon_preprocessed.jsonl`.
   They were deleted on 2026-01-07 (`f27fb8e`) but remain in history on `origin/main`. The pushed tag
   `v1.0.0-faiss-index` does not contain these files (checked).
   Questions: LeetCode "Content" clause (questions are LeetCode's property); Baekjoon (service shut down; who holds
   rights to its statements now); what removal from history requires (rewrite + force-push, GitHub support cache
   purge, forks); whether a DMCA-style request is likely.
2. **Derived research files on `origin/main`** (no statement text found): `Evaluation_100/data/ground_truth_v2.json`
   (Baekjoon ID -> LeetCode slug map), `research/full_catalog/labels.v1.jsonl` and `pool.v1.json` (pair IDs, hashes,
   AI-written rationales), research figures/receipts. Question: do ID/slug mappings and aggregates derived from
   collected data raise database-right or terms issues (EU sui generis database right; Korean Copyright Act
   database producer rights)?
3. **Committed locally, not yet pushed** (branch `feat/mock-contest`): `research/recommendation_inputs/` (executed
   notebook, HTML, blog draft, figures; a scan found no statement text), `RECOMMENDATION_ENGINE/` docs. Decide before
   pushing.

## Data sources

| ID | Data | Where in repo / disk | How obtained | Used for |
|---|---|---|---|---|
| S1 | LeetCode statements (3,053) and vectors derived from them | `data/raw/leetcode_raw_data.jsonl`, `data/processed/...`, `indexes/` (untracked, quarantined) | legacy `/graphql` collection | nothing current (quarantined) |
| S2 | LeetCode catalog metadata: title, slug, difficulty, tags, paid flag | `private-learning/mastery/catalog-v4/` (untracked) | derived from the same legacy `/graphql` collection | recommendations, mock contests, UI |
| S3 | Codeforces metadata, contest list, user rating/status | catalog-v4, provider cache | official API: `/api/problemset.problems`, `/api/contest.list`, `/api/user.rating`, `/api/user.status` | catalog, calendar, ratings |
| S4 | AtCoder metadata and difficulty models | catalog-v4 | AtCoder Problems (kenkoooo): `resources/problems.json`, `contests.json`, `contest-problem.json`, `problem-models.json` | catalog, difficulty |
| S5 | AtCoder upcoming contests | provider cache | HTML table parse of `https://atcoder.jp/contests/?lang=en` | calendar |
| S6 | LeetCode contest schedule | provider cache | ContestDeck community mirror of CLIST (`raw.githubusercontent.com/MaskedCarrot/contestdeck-data`) | calendar |
| S7 | Statement datasets (research only) | `private-learning/` | Hugging Face `deepmind/code_contests` (non-code CC BY 4.0 plus third-party conditions), IBM Project CodeNet | private research |
| S8 | Embedding/translation/rerank models | `private-learning/models/` | Hugging Face: `sentence-transformers/all-MiniLM-L6-v2`, `paraphrase-multilingual-MiniLM-L12-v2`, `sentence-transformers/LaBSE`, `intfloat/multilingual-e5-small`, `cross-encoder/ms-marco-MiniLM-L6-v2`, `Helsinki-NLP/opus-mt-ja-en` | research; a desktop app might bundle one |
| S9 | LLM explanations | `private-learning/` explanation ledger | Gemini API (`generativelanguage.googleapis.com`), NVIDIA API (`integrate.api.nvidia.com`, model nemotron-3.5-lightning) | per-recommendation prose |
| S10 | AI-reviewed concept labels | catalog-v4, `private-learning/mastery/judgments/` | AI judges (two model roles) | concept mapping |
| S11 | Company-wise LeetCode lists (proposed, not integrated) | none | `github.com/liquidslr/leetcode-company-wise-problems` (no license file; derived from LeetCode Premium company tags) | idea only |
| S12 | Learner's own solutions | `~/algorithm-solution` (separate private repo) | user's own work | evidence |

## Questions per source

- **S1/S2 LeetCode.** Terms: crawling/scraping forbidden, questions are exclusive content (T5); robots disallows
  `/graphql` and `/api/` (T6). Is redistributing titles/slugs/difficulty/tags (facts?) restricted by contract even if
  not copyrightable? Is a link-only design (store only what the user records, link to leetcode.com) acceptable? Does
  any official LeetCode API, partner program or written-permission route exist? Is using the "LeetCode" name in UI
  text and docs nominative fair use / allowed by their trademark policy?
- **S3 Codeforces.** API terms and rate limits; the terms forbid commercializing site material (T1). Is
  non-commercial redistribution of API metadata in a desktop app or website allowed? Attribution requirements?
  Using other users' public `user.status` data for evaluation research?
- **S4 AtCoder Problems.** License/terms of the AtCoder Problems project and its API (rate-limit guidance, data
  reuse, attribution). Who owns the difficulty model outputs? AtCoder's own ToS on third-party aggregations; its
  AI-training opt-out (T4) and whether sending titles to LLM APIs (S9) touches it.
- **S5 AtCoder HTML.** Is parsing the public contest list page allowed for a distributed app that every user runs?
- **S6 ContestDeck/CLIST.** License of the mirror repo and CLIST's terms for redistribution or derived use.
- **S7 Datasets.** CodeContests: CC BY 4.0 for non-code plus "third-party conditions" (which?). CodeNet license and
  problem-description terms. Confirm these stay research-only and are never shipped.
- **S8 Models.** License of each model (Apache-2.0 / MIT / CC-BY / other) and of its training data where the model
  card imposes conditions; obligations if weights are bundled in a desktop app (NOTICE, attribution).
- **S9 LLM APIs.** Gemini API terms and NVIDIA API Catalog/trial terms: may outputs be shown to third-party end
  users? Is the NVIDIA trial endpoint allowed in production or only for evaluation? Data retention and training use
  on free tiers; what is sent (problem keys, titles, concept labels, learner progress); output ownership; age/region
  limits; required disclosures ("AI-generated").
- **S10 AI labels.** Terms of the AI tools used to create them for reuse/distribution of their outputs.
- **S11 Company lists.** No license means all rights reserved; source data is LeetCode Premium. Confirm it cannot be
  redistributed and whether private personal use is acceptable.
- **S12 Learner data.** For web hosting only: privacy obligations (Korean PIPA, GDPR if EU users), code uploaded by
  users, retention and deletion.

## Cross-cutting

- Trademarks/logos: LeetCode, Codeforces, AtCoder, Baekjoon names in UI, README and app name; no logos currently.
- Open-source licensing of this repository itself: there is no LICENSE file (checked), so the code is all rights reserved
  by default even though the repository is public. Decide one before distribution.
- Third-party code bundled into a desktop build (Node runtime, Electron/Tauri if used, npm packages): license
  notices.
- Jurisdiction: the owner is in Korea; LeetCode (US), Codeforces (governing law UAE per T1), AtCoder (Japan).
