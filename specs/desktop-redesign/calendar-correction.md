# Calendar correction

## Observed cause

`renderCalendar` renders `dayPanel` alongside the calendar. Opening a problem via
`openInspector` adds `inspector-open`; the previous rule in `styles.css` collapsed
`calendar-workspace` to one column, pushing the selected-day list beneath the
calendar. The `more-events` action also opened `daily`, a second rendering of
the selected day's `dayContent`. These paths made the same records appear twice.

## Change

The date panel can be hidden, allowing the calendar to fill its column. A problem
detail temporarily hides the date panel, which returns on closing details.
The overflow action selects the date and opens its date panel rather than opening
a second list. Calendar row icons use Lucide 1.64.0 and retain visible status text.
Calendar event projections and learner data remain unchanged.

## Verification and limits

The synthetic browser fixture checks 25 attempts on one date, panel toggling,
status SVGs, and detail-panel replacement at three sizes. Node tests and the
existing Playwright inspector suite passed. Native Tauri rendering, all requested
Playwright calendar states, accessibility contrast, and installed-app packaging
remain unverified. Browser screenshots are temporary and synthetic.

## Packaged build follow-up (2026-10-30)

Rebuilt the frontend, refreshed the allowlisted stage with the verified standalone Node 26.8.1 and explicit catalog-v4/company-v2 sources. Removed only derived target/{release,debug}/{runtime-node,runtime,prototype,datasets} copies before building. The reported Permission denied did not recur; no chmod/security change or source/learner-data deletion was needed.

- Node regression: 356/356 passed (hosted and desktop suites).
- Tauri Rust tests: 6/6 passed.
- macOS arm64 unsigned Tauri app build: passed.
- Final package audit: 116 resource files verified, no forbidden data. Calendar workspace/styles, status SVG module, shared theme and Lucide license match current source byte-for-byte in the package.
- Separate packaged native smoke: close/cancel/new all passed. Journal HTTP 200 and available; exit 0; no observed owned survivors. All learner writes used disposable directories.

App: `desktop/src-tauri/target/release/bundle/macos/Algorithm Mastery DA0 Tauri.app`. Existing running processes and separately installed copies are not automatically refreshed by a build; launch this rebuilt app explicitly.

Receipts: [package audit](receipts/calendar-correction-package-audit.json), [launch](receipts/calendar-correction-native-launch.json), [onboarding](receipts/calendar-correction-native-onboarding.json).

This follow-up verifies build/package/native loading and shutdown. It does not complete the previously open native calendar visual inspection, all-state Playwright comparison, contrast audit, Windows host or installer/signing gates. No functional UI changes were made during this build test. Suggested documentation commit: `docs: record packaged calendar correction verification`. No commit/push performed.
