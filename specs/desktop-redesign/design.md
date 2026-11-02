# Monochrome editorial desktop workspace

## Research summary
See audit.md: direct DOM modules, CodeMirror, split iframe/native adapter shell, actual ledger-based projections.
Existing local compatible frontend-design skill was read; the explicit product specification governs aesthetics.

## Design proposal
One left sidebar (212px target) with quiet SVG line icons; white content canvas, thin rules, aligned headers/toolbars.
The standalone web app and native wrapper share navigation definitions and design tokens. Embedded learning content hides
its own shell; validated same-origin postMessage coordinates routes/editor handoff. No authentication boundary changes.

Typography: Pretendard local WOFF2 + deliberate Korean/Latin fallbacks; JetBrains Mono local WOFF2 for code. Shared sizes:
24/17/14/13/12/11px; tabular numerical text; Korean body line-height1.6. Spacing4/8/12/16/24/32px. Radius3/6px, borders
#E5E5E5/#CFCFCF, surfaces#FFF/#F7F7F7/#F1F1F1. Tableau colors centralized; green solved, orange attempted/unsolved,
blue planned, red overdue, purple contest, cyan manual duration; labels/shapes always accompany encoding.

Reusable DOM system: navigation/AppShell, SVG icons, PageHeader, Toolbar, CompactMetric, DataTable/ProblemRow,
StatusIndicator, EmptyState, segmented controls, tooltip/focus patterns. Existing accessible dialogs/forms are retained.
Chart containers have intrinsic useful height and visible scales, not empty oversized cards.

Layouts: Dashboard compact two-column learning queue/context; Calendar grid+day panel; Explorer catalog/records tabs with
facets/details; Analytics aligned overview/activity/distributions and drilldown; Contests compact table by temporal tab;
Company searchable pane+structured detail; Research comparison/library sub-tabs; IDE explorer/editor/bottom panels and
settings drawer. Scroll belongs to the page or explicit IDE pane, with each independent pane serving a clear task.

## Data flow and constraints
UI reads existing APIs/presentation events. A bounded read-only catalog search endpoint enables Explorer without loading
quarantined statements. Frozen recommendation scores/selection remain unchanged. Shared asset allowlists/package stager
must include only explicit new modules/fonts/licenses; no repository-root publishing. Pending writes, corrections,
backups, timers, contest participation, auth, Git sync and execution contracts are preserved.

## Migration plan
Add tokens/components/assets first, then switch shell routing to Dashboard and map legacy history to Explorer/research
aliases. Page implementations reuse existing detail/editor callbacks. Rebuild native adapter assets and package only after
browser/security/data regression. Keep unrelated dirty files and learner storage intact.

## Risks
Mixed iframe/outer navigation needs an explicit origin/source-checked protocol. Legacy source-shape tests require intentional
IA updates. Research runtime/catalog fields may be missing; expose unavailability. Self-hosted fonts require license and
bundle receipts. Native snapshots/build do not prove Windows or actual learning benefit.

## Top bar separation (2026-10-30)

The desktop top bar uses a fixed 48px secondary surface and strong bottom border, distinct from the white page/editor content. It remains outside scrolling content and retains route/status/shortcut controls.

## Native macOS title bar

Main and onboarding windows keep standard native traffic lights and content insets. Transparent titlebar material reveals a #E5E5E5 window background, with a light native appearance matching the fixed monochrome UI. HTML toolbars remain separate. Windows retains platform defaults. No custom close/drag handlers or execution/security changes.

## Internal top bar correction

Reverted the earlier HTML top bar change: original white surface, 44px height, subtle border and regular route label. Only native macOS titlebar chrome retains its neutral gray separation.

## Card and green-primary direction (2026-11-02)

User request: adopt the reference board `reference/check-direction.png` across the current design. This supersedes the
monochrome-only accent above for primary actions; Tableau status colours and their label/shape pairing are unchanged.

- Tokens (design-system.css): `--primary #2E7D32` (hover `#256628`, soft `#E8F3E9`), text `#111827/#6B7280`, borders
  `#E5E7EB/#D1D5DB`, surfaces `#F8F9FA/#F1F3F5`, radius 6/10px, `--card-shadow`. Interaction, focus and selected roles alias
  the primary. Dark mode defines its own primary (`#7CC583` on dark text) in both dark blocks.
- Typography: `--font-ui` now starts with the vendored Pretendard (its Latin glyphs derive from Inter), so no Inter download.
- Primary buttons, selected navigation and pressed segments use the primary; secondary controls stay neutral.
- Dashboard metrics and sections render as bordered cards (workspace-layout.css, CSS only, no DOM change).
- Inspector: mock-contest and contest details use the shared `inspector-section`/`inspector-facts` structure; lists have no
  indent so every block shares one left edge; inspector line-height 1.65 and 12px fact rows.

Not yet adopted (needs decisions, see tasks.md): dark sidebar, icon metric cards, plan progress ring, recent-problem cards,
calendar 8-week heatmap, company logos, Inter as a separate font.
