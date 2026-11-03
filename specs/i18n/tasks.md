# Korean / English interface: tasks

Each task is independently testable and leaves the app working in Korean. Open decisions D-1 (system default) and D-2 (AI
explanation language) must be answered before T1 and T9 respectively.

- [ ] T1 `hosted/public/i18n.mjs` with resolve/t/plural/format* and empty `messages/ko.mjs`, `messages/en.mjs`; add to the static
      allowlists (hosted/local.mjs, desktop/dev.mjs, package-stage). Unit tests: resolution from `system`/`ko`/`en` and
      navigator languages, placeholders, plurals, Asia/Seoul dates in both locales, contest durations (분/시간/日 vs min/h/d).
- [ ] T2 Catalog check script (`node hosted/i18n-check.mjs`): Hangul outside ko.mjs in migrated modules, key-set equality,
      placeholder equality. Start with an allowlist of not-yet-migrated files; each later task removes its file from it.
- [ ] T3 Preference plumbing: `language` in shell state.json with a bounded enum, `language-setting` command, browser-mode
      localStorage, `languagechange` event, frame propagation, `<html lang>`. Settings header gets the language icon (globe, menu:
      시스템 / 한국어 / English). Test: desktop/test + a Playwright check like appearance-playwright.
- [ ] T4 Migrate shared pieces: ui.mjs (navigation labels), overlays.mjs, desktop/ui/index.html + tools.mjs (code workspace,
      settings, start panel, problem dialog). Capture both languages.
- [ ] T5 Migrate workspace.mjs (dashboard, calendar, explorer, contests, inspectors) and workspace-data/learning-data labels;
      replace local date/duration helpers with format*.
- [ ] T6 Migrate analytics.mjs and analytics-data.mjs (TOPIC_LABELS to `{ko,en}`).
- [ ] T7 Migrate company.mjs and research-view.mjs.
- [ ] T8 Migrate app.mjs (legacy journal, tools, contest sources, backups) and onboarding.html.
- [ ] T9 Recommendation reason rendering from structured fields; fallback explanations in both languages; AI prompt language per
      D-2 (if translated: language becomes part of explanation cache identity; old Korean cache entries stay valid for `ko`).
- [ ] T10 Native strings: `set_language` command, Rust two-language table for dialogs and auth errors; build.rs/capability/bridge
      in sync; cargo test.
- [ ] T11 Remove the T2 allowlist; full validation: Node suites, desktop suites, cargo test, all browser smokes in Korean, and
      I18N-15 captures of every route in English at both sizes; README screenshots stay Korean unless decided otherwise.
