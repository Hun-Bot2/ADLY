# Appearance switching correction (2026-10-30)

## Cause and requirements

Dark tokens existed only under prefers-color-scheme. There was no user-facing preference, persistence or shell-to-learning preference propagation. The system SHALL expose system/light/dark choices in desktop settings, apply the selected appearance to shell/learning/editor, follow live OS changes only in system mode and preserve the enum across launches. Native titlebar appearance SHALL use a bounded main-window command. No learner schema, recommendation behavior, authentication or execution permission changes are required.

## Implementation

- appearance.mjs resolves a validated preference to data-theme and listens for OS/storage changes. CSS supports explicit light and dark, including light while OS is dark. Existing typography/status tokens are retained.
- Settings > 화면 모드 > 테마 provides 시스템 설정 따르기 / 라이트 / 다크. The existing authenticated desktop API persists appearance in shell state.json; localStorage propagates the selection immediately to the same-origin learning iframe. Shell state restores across newly assigned ports.
- Tauri set_appearance accepts only system/light/dark and only the main window; the existing per-launch origin capability explicitly permits this command. Native theme/background are updated without replacing standard window controls. Smoke-only logs prove command round-trips without exposing user data.
- CodeMirror content/caret/selection use appearance tokens. Autosaved preference controls are excluded from dirty-form snapshots; ordinary input protection remains intact.

Changed files: hosted/public/{appearance.mjs,design-system.css,app.mjs,overlays.mjs}, hosted/local.mjs, desktop/dev.mjs, desktop/ui/{tools.mjs,index.html,style.css}, desktop/src-tauri/{build.rs,src/main.rs}, desktop/test/dev.test.mjs. Added desktop/appearance-{playwright,native-smoke}.mjs.

## Verification

- [x] Desktop Node tests: 41 passed, including valid/invalid appearance and persisted state.
- [x] Rust tests: 6 passed.
- [x] Actual Playwright frontend: shell/calendar/editor light and dark at1280×800/1440×900; cursor colors verified. Manual choices override OS, system mode tracks live changes, reload/new server port/app restart restore the choice. No page errors. [Receipt](appearance/receipt.json).
- [x] Screenshots inspected: [light calendar](appearance/light-1280x800.png), [dark calendar](appearance/dark-1280x800.png), [settings](appearance/settings-dark.png), [light editor](appearance/editor-light-1280x800.png), [dark editor](appearance/editor-dark-1280x800.png).
- [x] Actual packaged Tauri appearance round-trips: light/dark/system applied and exited0. [Native receipt](appearance/native.receipt.json). This is native API evidence, not a native pixel/contrast audit.
- [x] Final macOS arm64 unsigned app rebuilt. [Resource audit](appearance/package-audit.receipt.json) verifies117 files and no forbidden data. Derived executable resources were removed before build to avoid the previously documented EACCES overwrite problem.
- [x] `git diff --check` passed.

All tests used disposable authored fixtures. Real learner data was untouched. Windows and a full native visual/contrast audit remain unverified. No claim of every route or third-party embedded document being individually contrast-audited is made. No live credentials/providers or remote writes were used. No commit/push performed.

Suggested commit: `fix(desktop): persist and synchronize light dark and system appearance`.

## Light default and status marker correction

Default appearance is now light when no valid preference is saved, even when OS appearance is dark. Explicit saved system/dark choices remain intact. The fallback is consistent in the frontend controller, desktop state API and settings order.

Dashboard priority labels now contain one Lucide status icon before the text. Removed the legacy colored left border and CSS-generated dot; retained the distinct system-recommendation provenance badge near problem metadata. Updated both desktop and compact row grids for the three-column structure.

Verification: 66 targeted Node tests passed. Playwright verified default light with dark OS, exactly one status SVG, zero label border and no ::before marker; existing light/dark/system and cross-launch persistence checks also passed. The [actual overdue row](appearance/overdue-default-light.png) was visually inspected. Suggested commit: `fix(ui): default to light and remove duplicate priority markers`. Existing learner data and explicit theme preferences were not modified.

Final Tauri macOS arm64 app rebuild passed; package resources match the final default/row source byte-for-byte. [Final audit](appearance/light-default-package-audit.json).
