# ADR 007: Desktop architecture — migrate the existing app into a desktop shell

Current shell decision: [ADR 009](009-tauri-only.md) selects Tauri by user override on 2026-10-30. The dual-candidate rule and Electron fallback below are historical; ownership and security constraints remain in force.

Historical status: accepted 2026-10-29 (revised the same day with the final product decisions). The shell choice (Tauri or Electron)
is made by the DA-0 decision rule below. Related: ADR 003 (local SQLite canonical), ADR 006 (adaptive progression),
ADR 008 (company metadata). Spec: `specs/desktop-app/`.

## Context

The desktop app is a **migration and extension** of the existing Algorithm RAG Engine, not a rewrite. It must inherit every
user feature: adaptive progression (progression-v2), recommendations, dashboard, journal, calendar, reviews, timers, Git
ingestion, contests, mock contests, history, backup and explanations. It also adds an editor, local execution and tests,
Git management, optional GitHub sign-in and remote sync, and company preparation, on **macOS and Windows**. The engine is
validated JavaScript on `node:sqlite` (Node regression suite, real-catalog replay, sensitivity receipts).

## Alternatives

| Option | For | Against | Verdict |
|---|---|---|---|
| A. Tauri v2 + Rust system backend + existing JS engine as a Node sidecar | Small native shell; Rust suits process control, files, Git, credentials and execution limits | Ships two runtimes; sidecar packaging and `node:sqlite` in the packaged Node are unverified | Preferred if DA-0 hard gates pass |
| B. Electron (main process in Node runs the existing engine in-process or as a utility process) | One language; Node built in | Larger install and memory (to be measured); `node:sqlite` depends on Electron's Node version | Chosen if A fails a hard gate |
| C. Local server + system browser | Exists today | Not an installable app; no native credentials or execution control | Development mode only |
| D. Rewrite the engine in Rust | One runtime | Porting risk to validated logic; no measured need | Rejected |

SQLite stays. Changing the database requires measured evidence (contention, corruption, startup) and a new ADR.

## DA-0 decision rule

Measure A and B on Apple Silicon macOS and Windows x64 with the same workload: the existing UI, the real catalog and the
company metadata, and a synthetic learner.

- Hard gates (must pass): `node:sqlite` works in the packaged runtime; the app starts, quits and restarts the engine
  without orphan processes; the catalog and company metadata attach from the app-data directory; OS credential storage
  works; signed builds can be produced (or the blocker is recorded).
- Recorded, not invented: installer size, installed size, idle memory (all processes), and cold start to the first journal render.
- Rule: choose A if it passes every hard gate on both OSes; otherwise choose B and record which gate failed. The size,
  memory and start numbers are reported to the user, who may override the rule.

## Ownership (both options)

| Resource | Owner | Others |
|---|---|---|
| Learner SQLite (all learner tables, snapshots, preferences, review targets, ingestion watermarks) | **JS engine process: the only writer** | Shell reads through the engine API only |
| Catalog and company metadata SQLite files | Build pipeline (immutable versions); attached read-only | — |
| Explanation ledger | JS engine | — |
| Solution repository writes (files, daily-log append, `git add/commit/fetch/merge --ff-only/push/clone/init`) | **Shell backend** (Rust in A, main process in B), one per-repository lock | The JS engine runs read-only `git log/show` for ingestion (existing) |
| Child processes (engine, code runs, git) | Shell backend | — |
| Credentials | Shell backend, OS store only (macOS Keychain, Windows Credential Manager) | Never the engine or the database |
| App/system settings (window, repositories mirror, sync mode, editor, toolchains) | Shell backend `state.json` | Learning preferences stay in SQLite via the engine |

## Consequences

- A pinned Node runtime ships with the app (option A) or with Electron (option B).
- Process separation is not a sandbox. Local code execution has its own limits (desktop-app design §5).
- Two test suites (Node, and Rust or Electron) plus per-OS smoke runs. GitHub-hosted CI is added for macOS and Windows (task DA-W).
- The Cloudflare Worker path (ADR 002) and the research viewers stay outside the installer (development mode).
