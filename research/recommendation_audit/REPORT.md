# Recommendation engine: statistical audit (2026-10-29)

Scope: the recommendation and mastery code that runs today (`hosted/mastery/*`, `hosted/core/policy.mjs`), catalog-v4, and existing
labels and research outputs. Reviewer role: independent. No application code, learner database or catalog was modified. No model was trained
and no network or paid API was used.

Inputs: Git HEAD `5fe47c8`. catalog-v4 `catalog-v4.sqlite3` sha256 `27a4ca62…cffde4` (matches its receipt). Real learner DB was read only for
aggregate counts (`mode=ro&immutable=1`). Scripts and outputs: this directory (`receipts/`). Every number below comes from those receipts
unless marked *static* (read from source) or *cited* (existing report, not rerun).

Reproduce (from the repository root; needs the private catalog):

```bash
python3 -I research/recommendation_audit/dist.py private-learning/mastery/catalog-v4/catalog-v4.sqlite3
python3 -I research/recommendation_audit/indep.py && node research/recommendation_audit/prod.mjs
node research/recommendation_audit/replay.mjs && node research/recommendation_audit/ablate.mjs && node research/recommendation_audit/remed.mjs
```

## A. Operational pipeline (what the user actually sees)

| Surface | Code path | Selection rule actually used |
|---|---|---|
| Journal / calendar (default UI, `/api/journal`, `explain`) | `journal.mjs journalPlan` | **Review slots** from `planDay` + **one** progression item (`progression.mjs next`). Planner exploit, explore and related slots are computed and **discarded**. Planner remediation is shown only when the latest attempt on some LeetCode Hard problem is a failure (`advancedRepair`). |
| Progression Easy/Medium stage | `candidateFor` | Eligible, unattempted, unexposed problem with the concept, a new variation signature, then **`pool[0]` after sorting by problem key (alphabetical)**. The prediction is computed and displayed but not used. |
| Progression transfer stage | `candidateFor` | CF ≤1000 or AtCoder ≤800 (non-experimental) with the concept; **highest `p_conservative` first**, i.e. the easiest problem. |
| Progression fallback | `planProgression` | If no transfer candidate: an AtCoder **title-embedding neighbour** with no concept (`title_v2`), labelled "semantic only". Can become the day's only curriculum item. |
| Concept order | `interview-curriculum.v1.json` | Authored order + prerequisites; a prerequisite is met only after its transfer stage (`stageIndex>=3`). |
| Legacy `plan` CLI | `planner.mjs planDay` | Reviews → remediation → exploit (p_conservative closest to 0.70 in [0.60,0.80]) → one explore slot (calendar rotation). |
| `related` CLI | `related.mjs` | Weighted score (section 4). Reached from the journal only through the discarded explore slot. |
| Mock contest | `mock-contest.mjs` | Separate spec (no title embeddings). UI prints `p_conservative–p_mean` as "해결 확률". |

Outcomes (policy v3, ADR 005): `ledger.attemptStream` maps independent/assisted/reported_completion → `independent, hints:false`. Every
downstream "independent" or "solved" count therefore means **completed**, including Git commits that carry no outcome.

## B. Mathematical audit

All formulas below were re-implemented independently in `indep.py` (no production imports) and compared with production
(`prod.mjs`). Agreement was exact to the printed precision in every case (`receipts/indep.json` vs `prod.json`). PAV was checked
against brute-force isotonic regression over all ordered partitions.

| Model | Formula (code) | Verified | Validity limits |
|---|---|---|---|
| LC level prior | Beta(3.2,0.8), Beta(2,2), Beta(0.8,3.2); prior weight 4 pseudo-observations | exec | Priors are authored; no fit to data. Cold start shows P(Easy)=0.80, P(Med)=0.50, P(Hard)=0.20 as "probabilities". |
| LC monotonicity | Weighted PAV on posterior means, weights α+β, E ≥ M ≥ H | exec (matches brute force) | Correct. |
| LC uncertainty | `sd` from the **unpooled** Beta(α,β) after the mean is pooled | exec | **Inconsistent**: e.g. Easy 1/4, Medium 4/4 → pooled mean 0.6375 for both, but Easy keeps sd 0.166 of a Beta whose mean is 0.525. The mean±sd band is not a posterior quantity. |
| `p_conservative` | LC: `max(0, mean − sd)`; CF/AtC: σ(a(μ−σ_μ−d)) | exec | Not a quantile. For easy AtCoder items it **exceeds** `p_mean` (μ=0, σ=400, d=−1400: p_mean 0.985, p_cons 0.989), because p_mean is marginalised toward 0.5 and p_cons is not. |
| CF/AtC ability | Online Laplace: one Newton step per observation, variance += 25²·weeks | exec (1158.5102 / 188.8413 on a 3-obs sequence) | Order-dependent approximation (no re-linearisation). Drift 25/week is authored. |
| `p_mean` | σ(a(μ−d)/√(1+πa²σ²/8)) (probit approximation) | exec | Approximation error vs Monte Carlo: 0.329 vs 0.332 (CF), 0.985 vs 0.992 (AtC). Acceptable. |
| CF slope | ln10/400 (Elo) | static | Assumption, documented in design §15. CF problem rating is the 50% point **in contest**; untimed practice success is not measured. |
| AtCoder internal rating | inverse of the low-rating map and the participation correction | exec (round trip within 3e-5) | Correct inverse. With 1 rated contest the correction is +1200 (displayed 1200 → internal 2400) while the prior SD stays 300 regardless of n: over-confident for new users. |
| AtCoder discrimination | constant 0.0044794 for all 4,866 IRT problems | exec | One-parameter logistic in practice. Difficulty is contest-conditioned; 947 problems are below 0 internal. |
| Concept posterior | Beta(1+s,1+f), 56-day window, `insufficient` if n<4 | static | Each attempt counts once **per concept** of the problem (65.5% of LC and 70.9% of CF recommendable problems have ≥2 concepts), repeated attempts count separately, and v3 counts uncommitted-outcome Git completions as successes. Not independent Bernoulli evidence. |
| Wilson interval | standard score interval | static | Correct formula; assumes independence that repeated attempts violate. |
| Calibration report | Brier vs in-sample constant-rate baseline, 3 bins, min n=30 | static | In-sample baseline; pairs exist only for problems the policy recommended (selection bias). |

Repeated observations (exec, `receipts/remed.out`): solving the same CF 800 problem 1/5/20 times moves CF ability to 1097/1219/1341 and
SD to 265/190/135, and after 6 repeats the status flips from `insufficient_evidence` to `estimated`. Repeats are treated as independent.

## C. Data and distribution (catalog-v4)

| Platform | Raw | Recommendable | Excluded (reason) | Difficulty present | ≥1 trusted concept (of recommendable) |
|---|---|---|---|---|---|
| LeetCode | 3,053 | 2,949 | 104 non-algorithmic tag | 3,053 levels | 2,735 (92.7%) |
| Codeforces | 11,457 | 10,897 | 560 special problems | 11,152 (305 none) | 10,345 (94.9%) |
| AtCoder | 9,793 | 9,613 | 180 heuristic/tutorial/practice/non-problem | 4,866 IRT (4,927 none, 50.3%) | **211 (2.2%)** |

- LeetCode recommendable E/M/H: 735 / 1,498 / 716 (24.9 / 50.8 / 24.3%). Access is `free_at_collection` for all rows (January 2026 snapshot).
- Codeforces rating: median 1800, IQR 1300–2400; **2,312 problems sit at the 800 floor** (20.7% of rated). 305 unrated.
- AtCoder IRT difficulty: median 1310, 5th pct −921; 514 experimental (weight 0.5); one shared discrimination.
- Concept provenance: 33,903 `ai_reviewed` rows, almost all `via=tag:<native tag>` (a reviewed tag→concept map applied to native tags);
  only 298 AtCoder rows come from per-problem AI judgments. The label "AI-reviewed concept match" therefore mostly means "native tag mapped".
- **Concept vocabularies are platform-disjoint** because they derive from each platform's tag set. With 0 recommendable Codeforces problems:
  arrays-hashing, prefix-sums, stacks-queues, heaps, sliding-window, linked-lists, tries, range-structures, ordered-structures,
  data-structure-design. With 0 LeetCode problems: constructive, flows-matching, linear-algebra, polynomials-fft, ternary-search.
- Popular-concept dominance (CF recommendable): greedy 3,533, implementation 2,963, dp 2,498; long tail below 120.
- Title reliability: AtCoder 1,564 `degraded` (16.0%, mostly Japanese-only titles), 6 unreliable; CF 42 unreliable (Russian).
- Aliases: 3. Duplicates across platforms are not resolved (identity research is separate).
- Real learner history: 9 attempts, all LeetCode, all Git (3 independent + 6 reported_completion), 0 failures, 0 ratings,
  14 journal snapshots (2026-10-18 … 10-28).

Candidate availability for the curriculum (exec, `receipts/replay.out`, prerequisites ignored):

| Concept | Effect |
|---|---|
| union-find, shortest-paths, range-structures | Fewer than 3 LeetCode Easy problems with distinct variation signatures (1, 0, 1). **The Easy stage can never complete.** |
| heaps, linked-lists, tries | No transfer candidate. Only a title-embedding fallback ("Parking", abc080_a, for heaps), which by design cannot complete the stage. |
| shortest-paths (also via heaps), trees → tries/range-structures | Prerequisite chains inherit these blocks. |
| Others | Transfer picks the easiest item: AtCoder internal −993 ("22222", abc394_a) for string-processing, −757, −426; CF 800 for 5 concepts. |

## D. Empirical evaluation

| Question | Evidence | Result |
|---|---|---|
| Relevance labels | 3,647 full-catalog pair records, all `label_source=ai_reviewed`, pooled from title neighbours; 180 relationship judgments by two AI roles; verification workbench: 40 human records, all self-marked non-independent | **No independent relevance labels.** The existing pool is built from the title channel, so it is not independent of `channel_rank`. research/recommendation_inputs/REPORT.md already reports 0 labelled slots in any method's top 10 (*cited*). |
| Precision/nDCG of related or progression picks | — | Not computable without labels. Not reported. |
| Calibration (Brier, log loss, reliability) | 9 real attempts, all successes, no stored-prediction pairs ≥30 | **Insufficient evidence.** Any score would be meaningless (y is constant). |
| Ranking sensitivity (related-v1, 196 deterministic LC sources, cold learner) | `receipts/ablate.out` | Candidate pool median 2,040 (p5 22, p95 4,368). Top-3 overlap with the full score after removing Jaccard **0.36**, channel 0.57, difficulty fit 0.49; after ×2 Jaccard 0.72, ×0.5 difficulty 0.86, ×2 channel 0.54. Within-pool SD: Jaccard 0.44, difficulty 0.22, channel 0.21; reviewed_edge is always 0 (no reviewed edges are passed in these code paths). |
| Difficulty of related picks (cold learner) | same | Median `p_conservative` of top-3 = 0.12 (target 0.70). 166 of at most 588 top-3 items (196 sources × 3) are CF 800: with prior N(1000, 350²), σ(a(650−800)) ≈ 0.30 is the best reachable value, so the difficulty term saturates at the floor. |
| Baselines (random, same-concept, difficulty-matched) | — | Can be generated, but without labels the comparison measures only agreement with the policy, not relevance. Not reported as accuracy. |

## E. Failure examples (all reproduced)

1. **Alphabetical curriculum.** Cold start → `leetcode:best-poker-hand` (first of 176 Easy arrays-hashing problems by slug). Following the
   recommendations: buddy-strings, check-array-formation…, then Medium 3sum-with-multiplicity, 4sum-ii. String-processing Medium →
   `leetcode:accounts-merge` (tags include String, but it is a union-find/DFS problem).
2. **Trivial transfer.** After 3 Easy + 2 Medium arrays-hashing, transfer = `atcoder:abc413_b` (internal −426). String-processing transfer =
   `atcoder:abc394_a` (−993). Solving an ABC A/B task completes "cross-platform transfer".
3. **Permanent remediation.** One failed practice attempt on 2026-08-01 that is never retried: the plan on 2026-08-03 and on 2026-10-28 both
   contain the remediation slot, and exploration is replaced every day (`receipts/remed.out`). The code comment says "in the last 7 days";
   requirement R4.5 says "a failed or assisted **review**". The code uses any latest failure, with no time bound.
4. **Unreachable placement.** Cold CF placement targets p_conservative 0.85/0.65/0.45 cannot be met (max ≈0.30 at the 800 floor), so the
   reason text reports "closest available" on every placement.
5. **Prior shown as probability.** Mock-contest UI shows "해결 확률 0.276–0.5" for Medium with zero history: the authored prior.

## F. Findings

| ID | Sev | Finding | Status |
|---|---|---|---|
| F1 | P1 | Easy/Medium progression candidates are the alphabetically first eligible slug; no difficulty, quality or relevance signal. This is the main user-visible recommendation. | Confirmed (exec) |
| F2 | P1 | Curriculum dead ends: union-find, shortest-paths, range-structures cannot pass Easy; heaps, linked-lists, tries have no transfer candidate; prerequisites propagate the block. | Confirmed (exec) |
| F3 | P1 | Remediation never expires and is triggered by any failed attempt, contrary to R4.5 and the code comment. | Confirmed (exec) |
| F4 | P1 | Transfer stage selects the easiest eligible problem (max p_conservative), so transfer evidence can come from trivial tasks. | Confirmed (exec); whether intended is a design decision |
| F5 | P1 | Policy v3 counts Git completions (success-only by construction) as solved evidence in calibration, concept posteriors, ISR and transfer. ISR is labelled "independent solve rate". | Confirmed (static + real counts: 6/9 real attempts are reported_completion). Intentional per ADR 005; the metric names and the mastery-journal requirement "Imported completion SHALL never become mastery evidence" are now inaccurate. |
| F6 | P1 | Repeated attempts on one problem are independent observations in ability fitting and concept posteriors. | Confirmed (exec) |
| F7 | P1 | User-visible semantic fallback uses title-embedding neighbours, which conflicts with the user's stated rule against title embeddings in recommendation (mock-contest R2.4 applies it only to mock contests). | Confirmed (static); needs a user decision |
| F8 | P2 | LC `sd` is not consistent with the pooled mean; `p_conservative` can exceed `p_mean` for AtCoder. | Confirmed (exec) |
| F9 | P2 | Related score is weight-sensitive (≈half of top-3 changes under single-component ablation or ×2 weight); weights are authored and unvalidated. `related` is not on the journal path. | Confirmed (exec) |
| F10 | P2 | Design §5.6 maintenance rule (mean ≥0.75, n ≥6 leaves exploit) is not implemented and not listed as a deviation. | Confirmed (static) |
| F11 | P2 | AtCoder prior SD 300 regardless of rated participations; n=1 adds +1200. | Assumption |
| F12 | P2 | Mock-contest "expected solves" sums `p_conservative`, which is not an expectation. | Confirmed (static) |
| — | — | No calculation defect was found in the implemented formulas (B). | Verified |

No P0 was found: no incorrect arithmetic (exec), no temporal leakage found by static inspection (`storedPrediction` only pairs plans dated
on or before the attempt; `readLedger` applies cutoffs; plans are frozen snapshots), and no outcome claim of educational effect (the journal states "Policy tests do not establish educational effectiveness").

## Revision 2026-10-29: intended workflow

The user's intended workflow makes progression the core experience and adapts it to performance. The only input is the
unchanged daily Markdown log (`# date`, `| 문제 | 결과 | 시간 | 복습 | 메모 |`; 복습 is a user flag, 메모 is not
evidence). Two further findings follow from that input (both checked 2026-10-29):

| ID | Sev | Finding | Status |
|---|---|---|---|
| F13 | P1 | Every daily-log row is ingested as `activity_type=practice` with no `transfer_from`, so progression-v1's transfer and retention stages can never complete from the Markdown log. | Confirmed (static: daily-log.mjs row metadata) |
| F14 | P1 | Review spacing grows only for `activity_type=review`; Markdown re-solves keep the interval at 1 day (solves on days 1, 2, 5, 12 → stage 0). | Confirmed (exec) |

Handoff items 2–4 below (ordering rule, dead-end reporting, transfer band) are **superseded** by the adaptive design in
`specs/adaptive-progression/` (requirements, design, tasks). Decisions D1–D11 were accepted on 2026-10-29 (ADR 006; D2–D4, D6 and the follow-up window are provisional).
Implementation follows `specs/adaptive-progression/tasks.md`. Items 1, 5, 6 and 7 are absorbed: remediation becomes D8, deduplication becomes T1/T3, interval consistency
becomes T2, and the metric rename stays. The design also shows by computation (`adaptive_sim.py`) that lower-bound
conservatism deadlocks the step-up, so conservatism lives in the priors instead.

## G. Implementation handoff (original; see revision above)

| # | Change | Target | Tests / acceptance |
|---|---|---|---|
| 1 | Bound remediation: latest **review** failure within 7 days without a later solve (or update R4.5 if any failure is intended). | `planner.mjs remediationConcepts` | Fixture: failure 3 days ago → remediation; 30 days ago → none; failure then solve → none. |
| 2 | Replace alphabetical `pool[0]` with an explicit, documented order (e.g. closest p_conservative to a stage target, then key) — the order rule must be decided first. | `progression.mjs candidateFor` | Fixture with 3 Easy candidates whose key order differs from difficulty order; acceptance = the documented rule, plus existing progression tests unchanged except candidate keys. |
| 3 | Detect dead-end stages and report them ("insufficient catalog coverage") instead of silently stalling; decide whether prerequisite unlock should require transfer. | `progression.mjs` | Test over the real distribution counts reproduced as a fixture: union-find with 1 Easy → status `insufficient_catalog`, not `in_progress`. |
| 4 | Transfer selection: target band instead of max p_conservative, or a documented minimum native difficulty. | `progression.mjs` | Fixture with −900 and +600 AtCoder candidates; the rule selects per spec. |
| 5 | Deduplicate repeated attempts per problem for ability fitting (e.g. first attempt per problem per window). | `calibration.mjs practiceObservations` | Same-problem ×20 must equal ×1. |
| 6 | Make `p_conservative = min(p_conservative, p_mean)` or rename; compute LC sd from the pooled block. | `calibration.mjs predict / fitLeetCode` | Property test: p_cons ≤ p_mean ≤ p_opt for random inputs. |
| 7 | Rename ISR in reports to "completion rate (policy v3)". | `metrics.mjs`, weekly report text | Snapshot test of labels. |
| 8 | Decide F7 (title-embedding fallback) with the user before changing code. | `progression.mjs` atcoder_fallback | — |

Do not change weights in `related.mjs` until independent labels exist.

## H. Verdicts

| Area | Verdict | Justification |
|---|---|---|
| Mathematical correctness | **VERIFIED** (formulas) / PROVISIONAL (interpretation) | Every formula matches an independent implementation; but pooled-mean/unpooled-sd and p_cons > p_mean are interpretation defects. |
| Data and label quality | **PROVISIONAL** | Catalog is hash-verified and denominators are explicit; concepts are tag-derived and platform-disjoint, AtCoder concept coverage is 2.2%, and no independent relevance labels exist. |
| Recommendation relevance | **INSUFFICIENT EVIDENCE** | No independent labels; the visible Easy/Medium order is alphabetical (F1). |
| Difficulty calibration | **INSUFFICIENT EVIDENCE** | 9 real attempts, all successes; contest-conditioned difficulties applied to practice are unvalidated. |
| Learning-outcome evidence | **INSUFFICIENT EVIDENCE** | Single learner, no comparison condition; ISR now measures completion. |
| Release readiness (recommendations) | **FAILED** | F1–F4 produce stalled or arbitrary user-visible plans on the real catalog. |

## Proposed evaluation designs (not started)

- **Blinded annotation (bounded):** 60 LeetCode sources stratified by concept and level; for each, pool top-5 from the current policy,
  same-concept random, difficulty-matched random and (if the user allows) title neighbours, deduplicated and shuffled with source of
  origin hidden. Grades 0–3 on two separate axes: *same required algorithm* and *useful next practice*. Two independent human raters, a third
  adjudicates; report Cohen's κ (weighted) per axis before any metric. Unjudged items stay unjudged. Metrics: P@3 and nDCG@3 per
  arm with source-level bootstrap intervals (resample sources, not pairs).
- **Calibration:** chronological replay storing `p_mean` at recommendation time and pairing it with the first subsequent attempt on that
  problem only; report Brier, log loss and binned reliability per platform once ≥100 pairs per platform exist, with problem-clustered
  bootstrap. Record manual failures; Git commits alone cannot calibrate (success-only).
- **Learning effect:** a single learner cannot support causal claims. If ever needed: alternating-week policy assignment (A/B within
  learner) on a pre-registered outcome such as delayed-review success on unseen same-concept problems.
