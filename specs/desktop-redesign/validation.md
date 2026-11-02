# Desktop redesign — final verification (2026-10-30)

Implemented a workflow redesign in the existing plain-DOM/Node/Tauri architecture. No learner schema, scoring, retrieval ordering, execution permissions or Git authorization changes were required. `check.png` informed the compact composition; its green theme, illustrative values and probability estimates were not adopted.

## Result

- One eight-route sidebar and secondary settings drawer; old history links resolve to searchable Explorer records. Record editing, correction history, original links and recommendation explanations remain available.
- Dashboard separates today's ordered plan from a bounded preview of the review backlog. Full queues remain accessible. Recent activity, actual trends and upcoming contests share the first workspace.
- Month/week calendar selects a day in place, uses bounded category marks/overflow counts and preserves dense-day records in the detail panel. Platform/type filters and keyboard selection remain operational.
- Analytics aggregates actual attempts, explicit outcomes, recorded durations and confirmed timer evidence. Missing time is not zero. Compact charts support selection and original-record drills; annual heatmap supports keyboard focus.
- Company selector, actual list matching, solved/attempted/unsolved distribution, difficulty/topic coverage and paginated problem rows replace text blocks. Source coverage and uncalibrated model estimates are explicitly separated.
- Contests use temporal tabs, local time, bounded titles and source details. Research presents unchanged stored rankings, provenance/input comparisons and stored maps; unavailable backends show an honest retry state.
- CodeMirror workspace has a repository explorer, editor, structured tests, execution/record/Git panels, resizable persistent layouts and keyboard shortcuts. Repository/auth/update configuration lives in settings.
- Shared typography/color/spacing tokens and licensed offline Pretendard/JetBrains Mono serve the shell, learning views and native onboarding.

## Executed verification

| Check | Result |
| --- | --- |
| `node --test hosted/test/*.test.mjs` | 315 passed |
| `node --test desktop/test/*.test.mjs` | 35 passed |
| `cargo test --manifest-path desktop/src-tauri/Cargo.toml` | 6 passed |
| `node desktop/browser-smoke.mjs` | 11 IDE workflows passed, including save/run/test/record/scoped Git commit and ingestion |
| `node hosted/workspace-browser-smoke.mjs` | 3 scenarios passed, including history correction and explanation states |
| `node hosted/company-browser-smoke.mjs` | 6 checks passed, including company focus/calendar/mock/reset/missing data |
| `node hosted/analytics-browser-smoke.mjs` | 6 checks passed, including actual aggregation, partial time coverage, drills and keyboard heatmap |
| `node desktop/redesign-browser-smoke.mjs` | 16 screenshots, 8 routes × 2 sizes; no horizontal overflow or runtime errors; research ranking/source/map/unavailable interactions passed |
| `npm run package --prefix desktop/src-tauri` | macOS arm64 unsigned `.app` built |
| `node desktop/audit-package.mjs ...` | 114 resource files verified; no forbidden data found |
| Packaged native onboarding smoke | close/cancel/new passed; exit 0 and no observed owned survivors |
| Packaged native launch/journal/quit | journal HTTP 200; exit 0; no observed owned survivors |

Restricted test runs initially could not bind loopback; the final runs above used permitted socket access. A stale generated debug executable resource caused EACCES; only derived target copies were removed and Rust tests passed on retry. These were environmental/build-artifact failures, not suppressed test failures.

All browser fixtures are authored synthetic data and do not represent the user's learning outcomes. Tests never wrote to the user's learner DB. Research browser tests injected the existing read-only backend contract; they do not prove live research availability. Native launch used a disposable learner and the supplied immutable catalog/company sources read-only.

## Inspected screen artifacts

Both 1280×800 and 1440×900 renders were captured. Dashboard backlog density and analytics heatmap month/weekday labels were corrected after visual inspection. Every primary page was inspected; actual editor/run output was inspected separately from the honest no-repository empty state.

- [Dashboard](screenshots/dashboard-1440x900.png)
- [Calendar, dense selected day](screenshots/calendar-1280x800.png)
- [Problem Explorer](screenshots/explorer-1280x800.png)
- [Analytics](screenshots/analytics-1440x900.png)
- [Contests](screenshots/contests-1280x800.png)
- [Company preparation](screenshots/company-1280x800.png)
- [Research comparison](screenshots/research-1440x900.png)
- [Editor and actual test output](screenshots/workspace-running-1440x900.png)

The screenshots and JSON receipts under this directory are durable authored-fixture evidence. Font provenance/license receipts live in hosted/public/fonts/manifest.json.

## Run

```sh
open "desktop/src-tauri/target/release/bundle/macos/Algorithm Mastery DA0 Tauri.app"
```

For development, see desktop/README.md. The native artifact is generated/ignored and remains an unsigned candidate.

## Remaining limits

- Windows host execution, signed installers, notarization, live GitHub authentication and remote push were not performed. Native macOS proof is not cross-platform release proof; final DA-0 shell selection remains open.
- Local execution retains existing limits and is not a security sandbox. macOS memory enforcement is still unavailable; the UI says so. No security behavior was weakened.
- Private research services are optional and are not bundled. Maps/similarity remain exploratory, not algorithm equivalence or validated learning recommendations.
- The onboarding smoke automates close/cancel/new, not the OS file-picker interaction. System-managed WebKit processes are outside owned-descendant measurements.
- Existing source rights/distribution gates, native ownership gates and prior backend roadmap items remain documented in specs/desktop-readiness/ and specs/company-prep/. The UI redesign does not certify distribution clearance or learning effectiveness.
- Python/pinned research suites were not rerun for this UI-only change; no pinned research inputs were modified. Live contest acquisition was not invoked; existing synchronization contracts were exercised through isolated API tests.

## Suggested commits (not created)

1. `feat(ui): establish monochrome desktop design system and unified navigation`
2. `feat(learning): redesign dashboard calendar analytics and discovery workspaces`
3. `feat(desktop): add persistent IDE panels and settings drawer`
4. `test(ui): verify desktop workflows visuals and native lifecycle`

The working tree contains earlier authorized work; review/stage intended files or hunks before committing. No commit or push was performed.

## Top bar follow-up

Separated the fixed 48px secondary-surface top bar from white content with a strong border. Repeated all 16 route/size captures: no runtime errors or horizontal overflow. Inspected the updated 1280×800 dashboard; Tauri candidate rebuilt with the change.

## Native title bar follow-up

Changed the actual macOS window chrome (main and onboarding), keeping native traffic lights and the standard content inset. A transparent titlebar exposes the neutral #E5E5E5 native background with light appearance; this is separate from the HTML top bar. Tauri package rebuilt successfully, Rust tests passed 6/6, and packaged close/cancel/new smoke passed (receipts/native-titlebar-onboarding.json). No window lifecycle or security behavior changed. An owned-window capture was attempted through CGWindowList plus screencapture, but macOS returned `could not create image from window`; the native titlebar color is therefore not screenshot-verified in this environment. Windows chrome is unchanged. Suggested commit: `fix(desktop): distinguish native macOS title bar from content`.

## Internal bar rollback

At the user's correction, restored the HTML top bar's original white surface, 44px height, subtle bottom border and route-label weight. Verified those CSS properties and that the separate native macOS titlebar gray setting remains. Frontend bundle and Tauri package rebuilt. No learner logic changed. Suggested commit: `fix(ui): restore internal top bar appearance`.
