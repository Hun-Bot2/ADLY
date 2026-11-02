# Research, audit and design

## Research summary

Read the user-specified official sources on 2026-10-30. Apple JavaScript pages exposed Markdown links; read their full official .md responses after the web tool rejected text/markdown. Existing frontend-design skill remains applicable; fixed Pretendard/monochrome product requirements take precedence over decorative suggestions.

- [Apple Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets): scoped short tasks; one sheet at a time; repeated observation belongs in a panel; macOS sheet is modal, not an iOS bottom sheet.
- [Apple Modality](https://developer.apple.com/design/human-interface-guidelines/modality): interrupt only for a clear benefit, provide clear dismissal, protect unsaved work and avoid modal hierarchies.
- [Apple Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers): a few contextual items near the trigger, one at a time, no nested views; outside dismissal must not discard work.
- [Apple macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos): keyboard/pointer, resizable windows and familiar consistent conventions.
- [NN/g Modal vs Nonmodal](https://www.nngroup.com/articles/modal-nonmodal-dialog/): reading background information should not block browsing; reserve interruption for essential input or consequences.
- [NN/g Chunking](https://www.nngroup.com/articles/chunking/): meaningful related groups and readable line lengths rather than card proliferation.
- [NN/g Layer Cake](https://www.nngroup.com/articles/layer-cake-pattern-scanning/): descriptive visually distinct section headings support scanning.
- [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): show core status/actions first, keep secondary rationale accessible on demand.
- [WAI APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus enters and remains in a true modal, Escape dismissal and logical focus restoration; background inert only for true modality.

## Audit and decisions

Actual stack remains ES-module DOM, native HTML dialog, embedded learning iframe in Tauri/desktop adapter. No UI framework or overlay library. Existing shared openDialog replaces dialogs, uses large 680/1040px widths and a text-heavy close button. Recommendation details duplicate metadata and verbose selection explanation, always show provider cards side by side and use modality for repeated browsing. Existing record forms have no dirty dismissal guard. Shell settings/problem/shortcut dialogs have implicit focus behavior and can stack. Native onboarding is a separate owned window with existing tested lifecycle.

| Existing surface | Decision |
| --- | --- |
| Recommended problem, historical attempt, catalog detail | Nonmodal right inspector, same selected-problem content updates; no backdrop or focus trap |
| Calendar day and chart raw-record drill | Nonmodal inspector for repeated browsing |
| Contest/mock detail and research document | Inspector for reading; coding stays dedicated workspace; long research document remains scrollable |
| Record add/correct, manual contest, sync/participation input | Compact modal task with guarded dirty dismissal |
| Settings | Preserve dedicated settings drawer; guard dirty input, prevent modal stacking |
| Problem open form | Compact modal, primary submit and safe cancel |
| Shortcuts / explanation limitations | Short contextual popover/disclosure, no forced modal for help |
| Native onboarding and OS confirmations | Preserve native lifecycle and safety behavior |

Supplied check.png is the available repository reference; no new problem-modal screenshot attachment is present. Capture the current rendered problem modal before editing as the definitive baseline.

## Design proposal

Right inspector occupies 400px (bounded by viewport), pushes the primary learning canvas at desktop widths. At smaller supported widths keep at least 480px of browsing canvas via compact navigation/layout. Title and actions remain discoverable; body has one explicit vertical scroll. Header includes title, platform/difficulty, external source and icon dismiss. Core sections: Learning, Review, AI Explanation, Recommendation Evidence. Saved provider texts use per-provider disclosure, with exact status/model/error metadata preserved. Evidence and historical provenance remain accessible without duplicated paragraphs. No synthetic content is shipped.

Input dialogs use 24px outer/body padding, 24px major groups, 8–12px related gaps, a compact icon dismissal and explicit Cancel alongside submit. Dirty dismissal changes the same dialog into an inline discard decision, not a stacked confirmation. Request-in-flight dismissals are blocked until the outcome is known. Inspector navigation restores focus only on explicit dismissal; replacing selected content does not steal background focus.

## Task breakdown and validation plan

1. Capture baseline with Playwright and authored disposable data.
2. Implement shared overlay lifecycle, focus/dirty guard, styles; retain backend contracts.
3. Refactor problem/attempt/catalog into grouped inspector, then other read-only overlays and shell help/forms.
4. Playwright after screenshots and assertions for background interaction, switching, focus return, links/editor handoff, all AI states/evidence, long content and modal keyboard/dirty handling.
5. Run existing engine/desktop/browser regressions; update affected presentation assertions only.
6. Build Tauri, run native close/cancel/new separately; document screen capture limits.

## Risks

Iframe sizing, route replacement and focus ownership can produce stale selections; inspector is detached/closed on route changes and update paths must preserve valid triggers. Auto-refresh must not erase dirty forms. Model availability is recorded state, not a live health probe. Browser dialog testing is not native WebView proof. Preserve original recommendation logic/data and all execution/auth boundaries.
