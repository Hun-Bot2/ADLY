# Desktop implementation batches (2026-10-29)

Current shell: **Tauri only**, selected by user override (ADR 009, 2026-10-30). Electron comparison/selection steps below are historical. Current runtime paths and verification: [Tauri-only migration](tauri-only.md). Historical measurement receipts are preserved.

## Research summary
Existing JS/SQLite engine and local workspace are preserved. ADR007 requires a measured shell choice on macOS and Windows.
Rust exists under ~/.cargo/bin but is absent PATH. Existing upstream checkout was temporary; reacquisition is attempted.

## Requirements
Implement CP-1/2/3, engine desktop boundaries, repositories/editor/runs/record/commit/sync, and optional sign-in contracts.
Only the engine writes learner SQLite. Tests use authored fixtures and temporary Git repositories. Remote push is manual.

## Design proposal
Company metadata attaches read-only. Company focus is an additive preference. Native-shell-neutral backend modules expose
allowlisted operations; the loopback development bridge is a prototype, not the final native trust boundary.
A Node adapter is provisional and does not decide Electron versus Tauri. No recommendation engine port.

## Task breakdown
- Company builder and pinned-data receipt.
- Company engine loader, scope, mock interviews and regression tests.
- Company views and authenticated engine API; opt-in contest sync.
- Repository, file/draft, execution, daily-log and Git/sync backend modules.
- Editor/tool UI and allowlisted bridge integration.
- Engine supervision, device flow abstraction, packaging allowlist and fixture CI.
- Integration regression, documentation and remaining release gates.

## Validation plan
Node engine suite; desktop backend tests; company builder tests; actual pinned-data aggregate comparison where available;
synthetic browser smoke when tooling allows. No tests write real learner data or solution repositories.

## Risks
DA-0 per-OS measurements are unavailable until both native candidates can be packaged and executed. Installed process
lifecycle and OS credential stores require separate checks. UI source/build checks do not prove installed app behavior.

## Implementation plan
Parallel agents own company policy, local API/company UI, and repository backend modules. Root owns integration/UI tools,
supervision/auth abstractions and packaging/CI. These batches are executable foundations even while native selection is pending.

## User-only release work
GitHub App registration/client id; signing certificates and developer accounts; user review of distribution considerations;
physical clean-machine checks when a host is unavailable. Local data copy requires the user's selection/confirmation at runtime.
