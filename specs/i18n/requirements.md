# Korean / English interface: requirements

Status: draft for review (2026-11-03). Scope: the desktop app (Tauri shell, desktop/ui, hosted/public learning frame) and the
local browser mode. Owner decisions marked **D-n** are open until the user answers them.

## Context (measured 2026-11-03)

- About 1,580 Korean text fragments are written inline in UI code: hosted/public/workspace.mjs 444, app.mjs 414,
  desktop/ui/index.html 154, company.mjs 127, desktop/ui/tools.mjs 111, analytics.mjs 100, research-view.mjs 78,
  analytics-data.mjs 41 (concept labels), workspace-data.mjs 30, smaller files under 15 each, onboarding.html 13.
- 11 date/number formatters use `ko-KR` or Korean literals (`2026년 11월 4일 수요일`, `10日`, `N시간 M분`).
- Engine text: hosted/mastery/explanations.mjs (27 Korean fragments: fallback explanations and AI prompts),
  hosted/core/policy.mjs (11, v1 reasons). Rust shell: auth.rs 4, main.rs 8 (dialog titles, errors). desktop/backend: 1.
- 32 test and smoke files assert Korean text.
- Daily logs already accept English column names (specs/mastery-journal/runbook.md, 2026-11-03).

## Requirements

### Language selection
- I18N-1 THE SYSTEM SHALL support two interface languages: Korean (`ko`) and English (`en`).
- I18N-2 The language preference SHALL have three values: `system`, `ko`, `en`. WHEN it is `system` THE SYSTEM SHALL use `ko` if
  the OS/browser preferred language starts with `ko`, otherwise `en`. **D-1:** confirm this default (alternative: always `ko`).
- I18N-3 The preference SHALL live with the appearance preference (desktop shell state.json; localStorage in browser mode), never in
  the learner SQLite database, and SHALL survive restarts and the random loopback port.
- I18N-4 The language control SHALL be an icon control in the settings modal header next to the appearance icons (user decision
  2026-11-03), with an accessible name in both languages. Changing it SHALL apply without restarting and SHALL update the
  embedded learning frame, like appearance does.

### Coverage
- I18N-5 Every user-visible string in desktop/ui, hosted/public, onboarding.html and native dialogs SHALL come from a message
  catalog; no Hangul or English UI literal SHALL remain inline in UI modules (enforced by a check, I18N-14).
- I18N-6 Dates, times, weekdays, numbers and durations SHALL be formatted for the active language. Contest durations SHALL keep
  the user's rule in Korean (분 up to 240, then 시간, then 日) and use `min` / `h` / `d` in English. The policy time zone stays
  Asia/Seoul in both languages.
- I18N-7 Concept labels (TOPIC_LABELS) SHALL have Korean and English names. Problem titles, platform names, company names and
  user-written text (daily-log memos, file names) SHALL NOT be translated.
- I18N-8 Recommendation reasons SHALL be rendered by the UI from structured fields (concept, action, probability, components), so
  both languages show the same facts. hosted/core/policy.mjs and the v1 progression modules SHALL NOT be modified (AGENTS.md v1
  byte-identity); their Korean reason strings are shown as-is in v1 mode only.
- I18N-9 Fallback explanations (no AI provider) SHALL exist in both languages. **D-2:** whether AI explanation prompts follow the
  interface language (new cache identity per language) or stay Korean.
- I18N-10 Native Rust dialogs (folder picker title, first-run copy confirmation, auth errors) SHALL follow the same preference.
- I18N-11 A missing English key SHALL fall back to Korean and be reported by the check (I18N-14), never shown as a raw key.

### Unchanged behaviour
- I18N-12 Switching language SHALL NOT change recommendations, learner data, snapshots, policy hashes or ingestion.
- I18N-13 Daily-log parsing SHALL stay language-independent (both header languages accepted regardless of interface language).

### Validation
- I18N-14 A check SHALL fail when a UI module contains Hangul outside the Korean catalog, when the two catalogs have different
  keys, or when a placeholder (`{name}`) differs between languages.
- I18N-15 Browser checks SHALL capture every route in both languages at 1280×800 and 1440×900 with no horizontal overflow
  (English strings are longer) and no runtime errors.
- I18N-16 Existing tests SHALL keep passing in Korean; smokes SHALL select elements by id/data attributes, not by Korean text,
  where they are touched.
