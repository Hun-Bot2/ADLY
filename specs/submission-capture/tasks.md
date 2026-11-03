# Submission capture: tasks

Step 0 (this spec) → step 1 (Codeforces sync). Steps 2–5 get their own task lists when step 1 is accepted.

- [x] S0 Requirements, design; D-1 (auto-append to log), D-2 (platform verdict, no flag), D-3 (no code; guide says paste) decided.
- [x] S1 Migration 009: `platform_submissions` and `submission_sync_marks` side ledgers (append-only triggers, source CHECK), migration
      test on fresh and existing fixture DBs; snapshot-before-migrate path unchanged.
- [x] S2 side-ledger.mjs validators for both payloads (exact field sets, enums, null rules SC-5/SC-6); ledger.mjs reads the tables.
- [x] S3 Pure normalizers: Codeforces `user.status` and AtCoder Problems items → layer-1 rows (skip in-progress verdicts, keep raw
      verdict, fingerprint fallback). Fixture tests with authored payloads only.
- [x] S4 Projection in attemptStream: problem-day grouping, import dedupe, log+submission merge (platform verdict, no flag); regression test that
      zero submissions reproduce the current stream exactly.
- [x] S5 Sync runner + CLI `submissions sync`: handle preference, backfill with page limit and resume, incremental stop at known id,
      sync marks, explicit network only. Tests with a mocked fetcher (no live calls in tests).
- [ ] S6 App: settings field for Codeforces handle, "동기화" button, last-sync status; calendar/explorer label for platform-verified
      attempts. Browser check with mocked provider.
- [ ] S7 Append synced problem-days to their date's Markdown log (SC-12; backfill after count confirmation) through the desktop backend; dedupe verified end to end.
- [ ] S8 Docs: runbook commands, AGENTS.md notes, user guide line on pasting code (SC-17); one live Codeforces sync of the user's own handle only after explicit approval.
