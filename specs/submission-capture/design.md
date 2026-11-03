# Submission capture: design

## Two layers

```
Layer 1  platform_submissions (new side ledger, migration 009)   one row per platform submission, append-only
           sources: codeforces_api | atcoder_problems_api | extension | manual
Layer 2  attemptStream projection (hosted/mastery/ledger.mjs)    one attempt per problem per KST date, as today
           daily-log rows (git_observations) ─┐
           platform_import events ────────────┼─ dedupe by problem-day / platform id ─► policy, Today, calendar
           platform_submissions ──────────────┘
```

Users keep seeing problem-centred logs; the engine keeps one attempt per problem-day; the full verdict history stays in layer 1 for
ML (SC-15).

## Layer 1 row

Table `platform_submissions` follows the existing side-ledger shape (sequence, entry_id UNIQUE, learner_id, schema_version,
occurred_at = submitted_at, recorded_at, source CHECK, payload, supersedes, canonical; no UPDATE/DELETE triggers).

`entry_id`: `sub:<platform>:<submission_id>` or `sub:<platform>:fp:<sha256(platform|problem_key|submitted_second|raw_verdict)[0:24]>`.
Insert uses `INSERT OR IGNORE` on entry_id (SC-3).

Payload (exact field set, validated in side-ledger.mjs):

| field | type | note |
|---|---|---|
| `platform` | leetcode / codeforces / atcoder | |
| `submission_id` | string or null | native id |
| `id_kind` | `native` / `fingerprint` | |
| `problem_key` | catalog key form | `codeforces:4A`, `atcoder:abc001_a`, `leetcode:two-sum` |
| `verdict` | normalized enum (SC-4) | |
| `raw_verdict` | string ≤ 64 | e.g. `WRONG_ANSWER`, `WA`, `Accepted` |
| `language` | string or null | |
| `judge_time_ms`, `judge_memory_bytes` | int or null | judge measurement, not solving time |
| `passed_tests` | int or null | Codeforces `passedTestCount` |
| `elapsed_seconds`, `active_seconds` | int or null | SC-5 |
| `time_source`, `time_confidence` | enums | `none` when unknown |
| `contest_id` | string or null | |

Code is not stored in v1. A later optional `code_sha256` can point at code kept in the user's repository.

## Normalizers (pure, Worker-safe, fixture-tested)

| platform | source | id | verdict map |
|---|---|---|---|
| Codeforces | `user.status` (official) | `id` | OK→accepted, WRONG_ANSWER→wrong_answer, TIME_LIMIT_EXCEEDED→time_limit, MEMORY_LIMIT_EXCEEDED→memory_limit, RUNTIME_ERROR→runtime_error, COMPILATION_ERROR→compile_error, TESTING/absent→skip, others→other |
| AtCoder | AtCoder Problems `user/submissions` (unofficial, ≥1 s spacing) | `id` | AC, WA, TLE, MLE, RE, CE; WJ/WR/Judging→skip; others→other |
| LeetCode | extension (step 3) | submission id from the result page | Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Runtime Error, Compile Error |

The existing `providers.mjs` importer stays for compatibility; its `submissionEvent` mapping is reused, not duplicated.

## Projection rules (ledger.mjs)

1. Group submissions by (problem_key, KST date of submitted_at).
2. If a daily-log attempt exists for the same problem-day: emit one attempt with the log's id, user fields and time; outcome from the
   platform group (SC-9, no conflict flag).
3. Else, if a `platform_import` attempt exists for the same problem-day or carries one of the group's ids (SC-10), keep it (solved) and add
   only the counts. Otherwise emit a submission attempt (`evidence_source = 'platform_submission'`, `self_minutes = null`). Every rule
   matches one problem-day; other problems on that date are unaffected.
4. Attempt carries `submissions`, `failed_before_accept`, `first_submitted_at`, `accepted_at` as extra read-only fields; policy v2 may
   ignore them until an ADR changes it.
5. With zero submission rows the function returns today's stream byte-for-byte (SC-11; regression test on existing fixtures).

Policy impact: adding rows changes recommendations (as intended); the policy code hash rotates journal plans on deploy, as for any
ledger change. No change to core/policy.mjs, calibration.mjs or progression.mjs.

## Sync (step 1)

- Preference `preferences.platform_accounts = {codeforces: handle, atcoder: handle}` (user-entered).
- `submission_sync_marks` side ledger: `{platform, handle, cursor, newest_submitted_at, status ok|error|partial, fetched, detail}`.
- Cursors are platform-specific (review 2026-11-03):
  - Codeforces `user.status` returns submissions by descending id, so row offsets shift when submissions are added or removed. The
    cursor is id-based, `cf2:<low>:<high>:<top>:<off>:<done>`: ids in [low, high] are stored, `top` is the newest id seen, `off` an offset
    hint for `low`. A run first reads newest pages until one reaches an id <= high (the gap above is then closed and `off` grows by the
    number of new ids), then backfills from `off - 1`. The first backfill row must be >= low (one-row overlap); otherwise rows were removed
    upstream and the run steps back a page. A page limit leaves `partial` with the state reached so far.
  - AtCoder Problems returns `epoch_second >= from_second ORDER BY epoch_second LIMIT 500` with no id tiebreak. The cursor is a second;
    each page re-reads its last second, so a second split across pages in any order is stored once. A new run starts 86,400 s before the
    cursor because the crawler can add older submissions late.
  - Submissions still being judged are not stored and hold the cursor below them (`high < id` / `cursor <= second`), so a later run
    re-reads them once they have a verdict.
- Errors append a mark and keep rows; re-reads are harmless because rows dedupe by entry_id.
- Triggers: CLI `submissions sync --platform codeforces`, a settings button in the app; no automatic first-launch fetch (SC-14).

## Open decisions

Decided 2026-11-03: **D-1** yes, auto-append to the date's log (SC-12; backfill after a count confirmation). **D-2** platform verdict,
no conflict flag. **D-3** no code in v1; the guide tells users to paste code (SC-17). LeetCode reacts to Submit only (SC-16).

## Validation

Migration test (fresh and upgraded DB, VACUUM INTO snapshot path unchanged), validator tests per field, normalizer fixtures per
platform, projection tests (no-submission identity, log+submission dedupe, import dedupe per problem-day, WA×5→AC sequence preserved), idempotent re-sync, interrupted backfill resume, offsets shifted by added/removed submissions, same-second page splits, in-progress and late-crawled submissions, and the existing Node suite unchanged.
