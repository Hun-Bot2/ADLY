# Submission capture: requirements (step 0 of the auto-recording plan)

Status: draft for review (2026-11-03). Plan order agreed with the user:
0 common submission record → 1 Codeforces official API sync → 2 extension transport/security design → 3 LeetCode extension MVP →
4 AtCoder integration and dedupe validation → 5 ML training sequences.

## Context (repository facts, 2026-11-03)

- Attempt evidence today: `events` (kind `attempt`, sources `manual` and `platform_import`) and `git_observations` (daily Markdown
  logs), merged once in `attemptStream` (hosted/mastery/ledger.mjs). Policy reads only that stream.
- hosted/providers.mjs already fetches Codeforces `user.status` and AtCoder Problems submissions, keeps **Accepted only**, and writes
  `platform_import` events (`event_id = import:<platform>:<learner>:<id>`). It is disabled unless `PROVIDERS_ENABLED=true`.
  core/events.mjs requires imports to be `reported_completion`, so failed submissions cannot be stored there.
- Help/hints are not tracked (ADR 005). Daily-log rows ingest as one attempt per problem per date.

## Requirements

### Record
- SC-1 THE SYSTEM SHALL store each platform submission once, as an append-only side-ledger row (AGENTS.md side-ledger contract), with
  the platform verdict, not only Accepted.
- SC-2 The identity SHALL be `platform + submission_id` when the platform provides an id (Codeforces, AtCoder Problems, LeetCode
  submission pages). Without an id THE SYSTEM SHALL use a deterministic fingerprint of platform, problem key, submitted-at second and
  raw verdict, and SHALL mark the row `id_kind = fingerprint`.
- SC-3 Re-running a sync, retrying an extension delivery or restarting the app SHALL NOT create a second row (idempotent insert on the
  identity).
- SC-4 Verdicts SHALL be normalized to: `accepted`, `wrong_answer`, `time_limit`, `memory_limit`, `runtime_error`, `compile_error`,
  `other`; the raw platform verdict SHALL be kept. Submissions still being judged (e.g. Codeforces `TESTING`) SHALL NOT be stored.
- SC-5 Time SHALL be stored as separate fields: `elapsed_seconds` (first view to submission), `active_seconds` (estimated activity),
  `time_source` (`none` | `browser_elapsed` | `browser_active` | `user`) and `time_confidence` (`none` | `low` | `medium` | `high`).
  Unknown values SHALL be null with source `none`. Platform judge run time/memory are judge measurements, stored separately, never
  as solving time.
- SC-6 THE SYSTEM SHALL NOT infer or fill unknown values (solving time, help used, review intent).
- SC-7 Problems not in the active catalog (e.g. Codeforces gym) SHALL be stored with their native key and excluded from policy
  until a catalog resolves them; they SHALL NOT be guessed.

### Projection (what the engine and screens see)
- SC-8 The engine SHALL keep reading one attempt per problem per KST date. A problem-day with submissions SHALL project to: solved if
  any submission that day is `accepted`, else failed; plus counts `submissions`, `failed_before_accept`, first/last submitted-at.
- SC-9 WHEN a daily-log row and submissions exist for the same problem-day THE SYSTEM SHALL produce one attempt, not two. The log keeps
  the user fields (review flag, memo, self-reported time); the outcome follows the platform verdict and a disagreement SHALL be
  flagged, not silently resolved. **D-2:** confirm platform verdict wins over a typed result.
- SC-10 Existing `platform_import` events SHALL be treated as the same submission as a submission row with the same platform id
  (no double count).
- SC-11 WHEN no submission rows exist THE SYSTEM SHALL produce exactly the current attempt stream (existing logs, tests, Today and
  recommendations unchanged).

### Markdown log
- SC-12 **D-1:** whether synced submissions also append a row to the day's Markdown log (visible and editable review/memo) or stay in
  the database only. If written, the row SHALL use the existing table format with the result filled from the platform, and SC-9 dedupe
  SHALL prevent the later Git ingestion from double counting.

### Sync state
- SC-13 Each source SHALL keep an append-only sync mark (cursor, status, count, error) so an interrupted backfill resumes and an
  incremental sync fetches only newer submissions. Failed syncs SHALL leave stored rows untouched.
- SC-14 Network use SHALL be explicit (user action or an enabled schedule), rate-limited (AtCoder Problems: at least 1 s between
  requests), and never automatic on first launch.

### ML readiness
- SC-15 The stored fields SHALL be sufficient to rebuild, per learner, an ordered sequence of (problem, concepts, difficulty,
  verdict, attempt index, timestamps, time fields with source/confidence), with schema_version on every row.
