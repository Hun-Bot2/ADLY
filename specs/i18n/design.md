# Korean / English interface: design

## Architecture

```
desktop shell state.json { appearance, language }          browser mode: localStorage
        │  (language-setting command, like appearance-setting)
        ▼
hosted/public/i18n.mjs  ── resolve(system|ko|en) → active locale
        │                 t(key, params), plural(key, n, params)
        │                 formatDate / formatTime / formatDuration / formatNumber
        ├── hosted/public/messages/ko.mjs   (canonical key set)
        └── hosted/public/messages/en.mjs
        ▼
UI modules (workspace, app, analytics, company, research-view, overlays, ui, desktop/ui/tools)
        render strings only through t()/format*(); re-render on 'languagechange'
```

- **Catalogs are JS modules**, not JSON: WebKit/WebView2 support for JSON import attributes varies, and the existing static
  allowlists (hosted/local.mjs, desktop/dev.mjs, package-stage) already serve `.mjs`. Add both catalogs and i18n.mjs to all three.
- **Keys** are dotted and grouped by screen: `dashboard.metrics.solvedToday`, `contest.status.upcoming`, `common.close`.
  Values may contain `{name}` placeholders. English plurals use `Intl.PluralRules('en')` with `.one` / `.other` keys; Korean uses
  `.other` only.
- **Formatting** moves out of the modules into i18n.mjs: the 11 current `Intl.DateTimeFormat('ko-KR', …)` calls and the local
  helpers (`labelDate`, `fmt`, `contestDuration`, `solvingTime`) call `formatDate(date, style)` etc., always with
  `timeZone: 'Asia/Seoul'` (policy time zone) and `ko-KR` / `en-US` by locale.
- **Language change** follows the appearance pattern: shell persists the enum, the shell page dispatches `languagechange`, the
  same-origin learning frame listens to the storage event and re-renders the current route. `<html lang>` is updated.
- **Native strings**: the shell passes the resolved language to Rust with a `set_language` main-window command (like
  `set_appearance`); Rust keeps a small two-language table for dialog titles and errors. Keep permission, capability and bridge in
  sync (AGENTS.md).
- **Engine output**: recommendation slots already carry `concept`, `action`, `estimate`, `components`; the UI builds the reason
  sentence from these. The engine's English `reason` string stays in data for audit. Korean v1 reasons (core/policy.mjs) are shown
  untranslated, and only in v1 mode.
- **Concept labels**: TOPIC_LABELS becomes `{ id: { ko, en } }` in the catalogs; unknown ids keep the existing slug fallback.

## Constraints

- No change to learner SQLite, snapshots, policy or progression hashes (switching language must not rotate plans).
- core/policy.mjs, calibration.mjs and progression.mjs stay byte-identical.
- No new dependency: `Intl` is built into WebKit, WebView2 and Node 26.
- Sidebar, buttons and tables must fit English text at the existing widths; long labels wrap or truncate with a title tooltip.

## Data flow

1. Launch: shell reads state.json → `language` (default `system`) → page resolves `ko`/`en` from `navigator.languages`.
2. User clicks the language icon → `language-setting` command → state.json updated → `languagechange` → modules re-render.
3. Frame receives the storage event → same resolution → re-render. No request to the learning engine is needed.

## Tradeoffs

| Option | Chosen | Why |
|---|---|---|
| JS catalogs vs JSON | JS | Works in every target webview and fits the static allowlists. |
| i18n library (i18next, FormatJS) vs small helper | Helper | ~1.6k strings, two languages, no ICU features beyond plurals; avoids a dependency and bundle growth. |
| Engine emits localized text vs UI renders from fields | UI renders | Keeps engine output language-free, hashes stable, audit text unchanged. |
| Translate AI explanations vs keep Korean | Open (D-2) | Translating changes provider cache identity and cost; Korean-only is cheaper but inconsistent in English mode. |

## Risks

- Large mechanical diff across the biggest UI files; regressions in rarely visited states (empty states, errors, inspector).
  Mitigation: migrate one module per task with its own browser capture, plus the Hangul check from task T2 onward.
- English text length breaking layouts (sidebar 190px, metric strip, contest columns). Mitigation: I18N-15 captures both sizes.
- Smokes that select by Korean text. Mitigation: switch touched selectors to ids/data attributes in the same task.
