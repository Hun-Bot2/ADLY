# Analytics and company preparation: implementation evidence

The implementation uses the existing ES-module DOM stack and centralized editorial design tokens. No learner-state,
recommendation, matching or database contract changes were made by these views.

## Analytics

`analytics-data.mjs` aggregates only active actual attempts. Solved-problem counts deduplicate problem keys; attempt counts
remain attempts. Success rate uses solved+failed outcomes and reports unknown outcomes separately. Plans never become
attempts. Difficulty retains its platform's native scale. Multi-topic records count once per distinct topic, and missing
topics remain missing.

Self-reported seconds/minutes have coverage counts; absent durations remain null. Confirmed timer intervals are unioned,
clipped to Korean civil month/year bounds and kept separate from manual time. Open/unconfirmed intervals are not elapsed
evidence. This presentation does not infer mastery or educational effects.

`analytics.mjs` renders compact metrics, a keyboard-accessible annual activity map, selectable daily/weekly trends,
outcome counts, difficulty/topic small multiples, observed low-frequency topics, review backlog and repeated problems.
Charts drill to existing record dialogs. The annual map explicitly follows year/platform and is separate from the
month-filtered overview. Long trends disclose a recent60 recorded-group limit; complete records remain in the drill.

## Company preparation

`company.mjs` preserves the existing company/preferences/mock APIs. The view has a searchable compact company directory,
a structured detail pane, disjoint solved/tried-but-uncompleted/unattempted counts, native difficulty table, topic record
coverage, focused stored recommendations and paginated source-ranked problems. Actual `journal` scoped slots are used
for recommendations; source-list rank alone is not called a recommendation.

Mock creation and returning to general learning remain available. Fill-from-general is in recommendation settings.
Provenance, unmatched counts and uncalibrated model estimates are available in a disclosure, separate from learner
history. No interview-success probability is invented. Code links preserve exact native identities and the existing
parent/native editor bridge.

## Validation executed

- `node --test hosted/test/analytics-data.test.mjs hosted/test/company-presentation.test.mjs`:8/8 passed.
- `node hosted/company-browser-smoke.mjs`: company listing/provenance, save focus, calendar badge, mock creation, general
  reset and missing-layer fallback all passed without runtime exceptions. Captured1280x800 and1440x900 screenshots.
- `node hosted/analytics-browser-smoke.mjs`:18 authored actual attempts, partial-duration coverage, metric/chart original
  record drill, keyboard heatmap focus and both viewport overflow checks passed without runtime exceptions.
- Actual screenshots were inspected. Header grouping, outcome encoding and company problem-list priority were revised;
  heatmap labels were prevented from wrapping. Data fixtures and temporary learner databases were used throughout.

The standalone component screenshot experiment was temporary; the committed browser scripts use actual local APIs.
Installed native-shell interaction and the parent's complete-route validation are separate evidence.
