# ADR 010: Submission-level ledger beside problem-day attempts

Status: proposed (2026-11-03). Spec: specs/submission-capture/.

## Context

Recording by hand is the main friction reported by users. Automatic capture (Codeforces API, AtCoder Problems, a browser extension)
produces submissions with verdicts, including failures and retries. The current evidence model stores one attempt per problem per day
(`git_observations`) and platform imports as Accepted-only `events` (core/events.mjs forbids other outcomes for imports). Future
knowledge-tracing and solve-probability models need the full verdict sequence.

## Decision

Add an append-only `platform_submissions` side ledger (one row per platform submission, idempotent on `platform + submission_id` or a
fingerprint) and project it into the existing attempt stream as one attempt per problem-day, merged with daily-log rows and existing
imports. core/events.mjs, core/policy.mjs and the v1 progression modules are not changed.

## Consequences

- Failures, retries and judge measurements are kept for ML without changing what the policy consumes.
- Dedupe rules (problem-day, platform id) become part of ledger.mjs and need regression tests; with no submissions the stream is
  unchanged.
- Recommendations change once submissions exist, which rotates journal plans through the existing code hash.

## Rejected alternatives

- Extend `events` with failed imports: would change core/events.mjs validation and the v1 core contract.
- Store submissions only in Markdown: loses verdict sequences and ids needed for idempotency.
- One attempt per submission in the policy stream: inflates attempts for retries and changes every existing estimate.
