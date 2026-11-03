-- Submission capture (specs/submission-capture): per-submission verdict ledger and sync marks. Additive only.
CREATE TABLE platform_submissions (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL UNIQUE,
    learner_id TEXT NOT NULL REFERENCES learners(learner_id),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    occurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('codeforces_api','atcoder_problems_api','extension','manual')),
    payload TEXT NOT NULL,
    supersedes TEXT UNIQUE REFERENCES platform_submissions(entry_id),
    canonical TEXT NOT NULL,
    CHECK (supersedes IS NULL OR supersedes != entry_id),
    CHECK (occurred_at <= recorded_at)
);
CREATE INDEX platform_submissions_owner ON platform_submissions(learner_id,sequence);
CREATE TRIGGER platform_submissions_no_update BEFORE UPDATE ON platform_submissions
BEGIN SELECT RAISE(ABORT, 'platform submissions is append-only'); END;
CREATE TRIGGER platform_submissions_no_delete BEFORE DELETE ON platform_submissions
BEGIN SELECT RAISE(ABORT, 'platform submissions is append-only'); END;
CREATE TABLE submission_sync_marks (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL UNIQUE,
    learner_id TEXT NOT NULL REFERENCES learners(learner_id),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    occurred_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('codeforces_api','atcoder_problems_api')),
    payload TEXT NOT NULL,
    supersedes TEXT UNIQUE REFERENCES submission_sync_marks(entry_id),
    canonical TEXT NOT NULL,
    CHECK (supersedes IS NULL OR supersedes != entry_id),
    CHECK (occurred_at <= recorded_at)
);
CREATE INDEX submission_sync_marks_owner ON submission_sync_marks(learner_id,sequence);
CREATE TRIGGER submission_sync_marks_no_update BEFORE UPDATE ON submission_sync_marks
BEGIN SELECT RAISE(ABORT, 'submission sync marks is append-only'); END;
CREATE TRIGGER submission_sync_marks_no_delete BEFORE DELETE ON submission_sync_marks
BEGIN SELECT RAISE(ABORT, 'submission sync marks is append-only'); END;
INSERT INTO schema_migrations(version,name) VALUES (9,'009_platform_submissions');
