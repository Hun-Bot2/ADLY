# ALDY-only maintenance and Git warning recovery (2026-10-31)

User requested removal of the previous app and investigation of solutions/history_rewritten.

## Verified findings

The running app was ALDY. The previous Algorithm Mastery generated .app was the only older product bundle found in the supported application/build locations and was removed after checking its bundle metadata. Its app-data directory, credentials, solution repository and backups were not removed. ALDY remains the app in use.

The registered solutions path and branch were correct. Its saved watermark SHA existed and exactly equalled current main/HEAD; a read-only Git ancestry check succeeded. Repository reflog showed no rewrite in the inspected recent entries. The original failed Git invocation's stderr had not been preserved, so its precise historical trigger remains unknown.

## Code correction and data-safe recovery

The ingester previously mapped every merge-base failure to rewritten history. isGitAncestor now returns false only for exit1; other execution failures raise an unavailable-check error before any watermark is appended. Actual rewrite detection and the explicit anchor gate remain intact.

Took a SQLite-consistent backup, quit ALDY and waited for its owned engine to stop, then invoked the existing CLI to explicitly re-anchor at exactly the same stored SHA/current HEAD. No commits were skipped or history rescanned. A subsequent ingest returned up_to_date. The original events and all9 Git observation rows were compared byte-for-byte with the backup both before and after relaunch. No original learning record changed.

Rebuilt ALDY, audited packaged resources, relaunched with the same real app-data directory and read its live authenticated sync status. solutions returned up_to_date with lastError null. ALDY was intentionally left running for the user. No credentials/session cookies were printed. Backup path, hash and live status receipt remain private under private-learning/desktop-maintenance/aldy-only-recovery.json; backups remain alongside app data.

Uncommitted solution-repository edits were preserved and not committed automatically. The ingester reads committed Git history; uncommitted VS Code changes require a later user commit.

## Validation

- Targeted Git ingestion/sync tests: 11 passed, including exit1 versus128/ENOENT/EACCES classification and existing forced-history protection.
- Full Node engine/desktop suite: 357 passed.
- ALDY macOS arm64 unsigned build and resource audit passed.
- Live real-app sync read: solutions up_to_date, lastError null.
- Previous app bundle absent; original observation/event rows preserved.
- git diff --check passed.

No new signing, Windows or full visual-accessibility verification is implied. No Git push, commit or user-file edit was performed. Suggested commit: `fix(git): distinguish ancestry check failures from rewritten history`.
