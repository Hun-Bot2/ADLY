# Modal and inspector implementation / verification

2026-10-30. Implemented directly in the existing frontend; no learner schema, stored record, ranking, provider generation contract, execution permission, credential flow or Git authorization was changed. The native title bar remains gray and the internal top bar remains white as previously requested.

## Changed components

| File | Responsibility |
| --- | --- |
| hosted/public/overlays.mjs | Shared nonmodal inspector, compact dialog, dirty cancellation, single-modal lifecycle, focus restoration |
| hosted/public/workspace.mjs | Problem/review/attempt/catalog hierarchy; calendar/day/chart/contest/mock/library reading surfaces |
| hosted/public/styles.css | 400/360px inspector, 24/12/8px internal rhythm, compact dismiss/actions, provider disclosures, long-content wrapping and bounded scroll |
| hosted/public/app.mjs | Close stale inspector on all route navigation |
| hosted/local.mjs, desktop/dev.mjs | Explicit static allowlist for overlays module; no broader filesystem access |
| desktop/ui/tools.mjs, index.html, style.css | Guarded settings/problem dialogs; shortcut help becomes a contextual nonmodal popover; consistent dismiss controls |
| desktop/inspector-playwright.mjs | Actual frontend Playwright fixture and regression/screenshots |
| Existing workspace/analytics/IDE browser smokes | Updated read-surface selectors while preserving original functional assertions |

The interaction decision inventory and nine source references are in [design.md](design.md). Recommended problems, historical attempts, catalog items, raw analytics records, dates and contest/mock details use an inspector. Record entry/correction and other focused input remain modal. Coding stays in the code workspace. Help is transient nonmodal context. Existing native startup/OS dialogs retain their owned-window lifecycle.

Problem header, Learning, Review, AI Explanation and Recommendation Evidence are separate semantic groups. Source links and editor actions remain available. Provider states and model/error/cache details are unchanged; absent records say unknown/no record rather than fabricated availability. Text is disclosure-based. Original rationale, version history, company provenance and all attempts including superseded records remain reachable. Saved AI text retains its unverified warning. The viewport does not trigger generation.

## Actual rendered screenshots

Authored fixtures, not real learner outcomes. Captured in Playwright against startDesktop/startLocal using installed Chrome; neither screenshots nor sample values ship as product data. The three-size before baseline was captured before implementation. Every state below was visually inspected; short-help wrapping and keyboard focus restoration were refined after review.

| State | Artifact |
| --- | --- |
| Before, large blocking modal | [1280×800](screenshots/before-modal-1280x800.png), [1440×900](screenshots/before-modal-1440x900.png), [1024×720](screenshots/before-modal-1024x720.png) |
| After, compact input modal | [1280×800](screenshots/after-modal-1280x800.png), [1440×900](screenshots/after-modal-1440x900.png), [1024×720](screenshots/after-modal-1024x720.png) |
| Inspector open | [1280×800](screenshots/inspector-open-1280x800.png), [1440×900](screenshots/inspector-open-1440x900.png), [1024×720](screenshots/inspector-open-1024x720.png) |
| Inspector closed | [1280×800](screenshots/inspector-closed-1280x800.png), [1440×900](screenshots/inspector-closed-1440x900.png), [1024×720](screenshots/inspector-closed-1024x720.png) |
| Saved explanation and provider failure | [AI available](screenshots/ai-available.png) |
| No saved explanation / not configured / basic fallback | [AI unavailable](screenshots/ai-unavailable.png) |
| Long title and long review note | [Title](screenshots/long-problem-title.png), [Review note](screenshots/long-review-note.png) |
| Keyboard focus and unsaved protection | [Focus](screenshots/keyboard-focused.png), [Inline discard choice](screenshots/modal-dirty-guard.png) |
| Original recommendation evidence | [Evidence](screenshots/recommendation-evidence.png) |
| Nonmodal shortcut help | [Popover](screenshots/shortcut-popover.png) |

The before problem modal and after inspector are the same reading workflow. The separate after input-modal screenshots demonstrate the retained focused-task pattern, not a claim that the problem-reading modal remained modal.

## Executed regressions

- Engine/API Node suite: **315 passed**.
- Desktop Node suite: **35 passed**.
- Playwright: **6 workflow groups passed**, no page errors, screenshots at all three sizes, no page/inspector/modal horizontal overflow. Checked initial focus, modal containment including Shift+Tab, inspector-to-background keyboard navigation, Escape, safe discard/continue, focus return, nonmodal background navigation, long content, provider states/errors, fallback, evidence, actual external-link click (intercepted fixture, no live platform fetch), and validated editor handoff.
- IDE browser smoke: **11 checks passed**, including recommendation-to-editor, save, bounded execution/tests, record, scoped commit and actual fixture ingestion.
- Learning workspace browser smoke: **3 provider scenarios passed**, preserving real fixture record add/correction/superseded history, retry, contest sync/source/dates and responsive behavior.
- Analytics browser smoke: **6 checks passed**, including raw-record inspector, actual counts and missing duration coverage.
- Tauri macOS arm64 **unsigned app build passed**.
- Packaged resources: **115 files verified**, no forbidden data; includes overlays module.
- Separate native packaged close/cancel/new smoke: **3 cases passed**, exit 0, no observed owned survivors; disposable learner only.

Receipts: [Playwright](screenshots/playwright.receipt.json), [browser regressions](receipts/), [native lifecycle](native-onboarding.receipt.json), [package audit](package-audit.receipt.json).

## Native status and remaining issues

Playwright verifies the actual supported frontend in Chrome, not Tauri's WebKit integration. Packaged native startup/loading/exit was tested separately. Native Inspector/VoiceOver interaction and a native-window screenshot were not independently verified; the environment's previous owned-window capture failed. Windows host validation, signing/notarization and OS picker automation remain open. No claim of full native accessibility certification is made.

Inspector body has one bounded scroll; exceptionally long titles have a bounded, independently scrollable header title so the action remains reachable. At widths below 760px it overlays part of the canvas without making it inert; the supported 1024×720 case uses a side-by-side composition. Extended research documents retain an embedded read-only document viewer. Browser focus/keyboard testing is not a screen-reader audit.

Playwright was installed with scripts disabled in /private/tmp/mastery-playwright, without changing product dependencies. To rerun, set PLAYWRIGHT_MODULE to an installed Playwright index.mjs and use the script above; Chrome is selected explicitly. Python and pinned scientific suites were not rerun because their code/inputs were unchanged. No live providers, GitHub login/push or external statement acquisition were invoked.

## Suggested commit

`feat(ui): replace problem modals with grouped inspectors and safe task dialogs`

No commit or push was performed. Preserve unrelated existing working-tree changes when staging.
