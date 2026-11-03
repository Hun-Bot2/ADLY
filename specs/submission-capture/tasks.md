# Submission capture: tasks

Step 0 (this spec) → step 1 (Codeforces sync). Steps 2–5 get their own task lists when step 1 is accepted.

- [x] S0 Requirements, design and open decisions (D-1, D-2, D-3) written.
- [ ] S1 Migration 009: `platform_submissions` and `submission_sync_marks` side ledgers (append-only triggers, source CHECK), migration
      test on fresh and existing fixture DBs; snapshot-before-migrate path unchanged.
- [ ] S2 side-ledger.mjs validators for both payloads (exact field sets, enums, null rules SC-5/SC-6); ledger.mjs reads the tables.
- [ ] S3 Pure normalizers: Codeforces `user.status` and AtCoder Problems items → layer-1 rows (skip in-progress verdicts, keep raw
      verdict, fingerprint fallback). Fixture tests with authored payloads only.
- [ ] S4 Projection in attemptStream: problem-day grouping, import dedupe, log+submission merge with conflict flag; regression test that
      zero submissions reproduce the current stream exactly.
- [ ] S5 Sync runner + CLI `submissions sync`: handle preference, backfill with page limit and resume, incremental stop at known id,
      sync marks, explicit network only. Tests with a mocked fetcher (no live calls in tests).
- [ ] S6 App: settings field for Codeforces handle, "동기화" button, last-sync status; calendar/explorer label for platform-verified
      attempts. Browser check with mocked provider.
- [ ] S7 (after D-1) Append today's synced problem-days to the Markdown log through the desktop backend; dedupe verified end to end.
- [ ] S8 Docs: runbook commands, AGENTS.md notes; one live Codeforces sync of the user's own handle only after explicit approval.
