# Manual attempt entry removal

User decision: new solution records are authored in VS Code, so remove app-side manual creation. This supersedes earlier UI requirements to expose add-record actions; existing record preservation and ingestion contracts remain in force.

## Requirements and implementation

- The app SHALL have no new-attempt form or add-record button in Calendar, day details, problem/catalog details, mock contests, learning settings, legacy journal or Code Workspace.
- Existing imported/manual/superseded records MUST remain searchable and readable. Existing manual record correction and queued-write retry MUST remain available; no data is deleted.
- VS Code-authored Markdown, local Git ingestion, code execution and scoped commits MUST remain operational.

Removed calendar/day/catalog/mock new-record actions, the settings entry tab, legacy attempt/journal input forms, and Code Workspace's daily-log form/handler. The record panel is now labelled 풀이 이력 and remains read-only. Guarded the retained correction editor against null/new attempts. The newer calendar toolbar's add-record shortcut was also removed while preserving its navigation/filter menus. Existing backend/CLI APIs are retained for ingestion, compatibility and corrections; no schema/migration change is needed.

## Verification

- Node engine/desktop suites: 356 passed.
- Playwright: Calendar/day panel and catalog have no manual add actions; historical correction, dirty protection, explanations, evidence and editor handoff remain functional. Actual updated calendar screenshot inspected: [no entry actions](../inspector-ux/screenshots/calendar-without-manual-entry.png).
- IDE regression: VS Code-style external Markdown file was written to the disposable solution repo, committed through scoped Git UI and actually ingested by the engine. The history panel has no record-form. Eleven workflows passed, including save/run/test/draft restoration.
- Workspace regression: three explanation scenarios passed, preserving historical correction, offline retry, contests and records.

The source UI test fixture was updated for matchMedia/documentElement because appearance initialization now runs on import. The old mock-record-button assertion was replaced with an assertion that no new manual record action exists. The current day-panel behavior was also reflected in the browser fixture. Browser histories are disposable authored data, never the user's learner database.

No existing record was removed or rewritten, and the external VS Code solution repository was not modified. Validation writes used temporary fixture directories. No live provider, remote Git push or real account action was performed.

Suggested commit: `feat(ui): remove manual attempt creation in favor of VS Code records`.
No commit/push performed.

Final Tauri macOS arm64 unsigned app build passed. Resource audit verified117 files with no forbidden data; served UI sources match the final package. Native launch returned journal HTTP200/available, exit0 and no observed owned survivors. [Package receipt](receipts/manual-entry-removal-package.json), [native launch](receipts/manual-entry-removal-native.json). Native pixel/accessibility/Windows verification remains outside this removal check.
