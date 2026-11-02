# Ordered implementation and validation

- [x] A1 Audit actual stack, routes, screenshot evidence, skills and tests.
- [x] B1 Record requirements, IA, design tokens, page layouts, migration and risks.
- [x] C1 Shared tokens, offline fonts/licenses, reusable components, unified navigation.
- [x] C2 Dashboard, compact Calendar, historical access through Explorer and details.
- [x] C3 Data-dense interactive Analytics and Company preparation.
- [x] C4 Contests and unified Research workflows with source limitations.
- [x] C5 IDE layout, persistent resizable panels, shortcuts and settings drawer.
- [x] C6 Integrate assets/read-only Explorer API and preserve security boundaries.
- [x] D1 Real Chrome screenshots and interaction checks across8 pages at both target sizes; fix issues.
- [x] E1 Node/data/API/Git/execution regressions and Tauri tests/build/package audit.
- [x] E2 Native smoke, final receipts, limitations, documentation and logical commit suggestions.

Implementation is divided into independently owned page modules, IDE and root shell/API/assets integration.

## Card and green-primary direction (2026-11-02)

- [x] Green primary, neutral palette and radius tokens in light and dark modes.
- [x] Pretendard first in the UI font stack.
- [x] Dashboard metric and section cards.
- [x] Inspector alignment and spacing for mock contests and contests.
- [x] Native shell: allowlisted external links open in the OS browser (on_navigation also receives target=_blank).
- [ ] Decide: dark sidebar as in the reference board, or keep the light sidebar.
- [ ] Decide: icon metric cards, plan progress ring and recent-problem cards on the dashboard (DOM changes).
- [ ] Decide: calendar right-panel stats and 8-week heatmap (analytics already has an activity map).
- [ ] Decide: company logos (trademark use) or text-only company rows.
- [ ] Apply card surfaces to analytics, contests and company pages after the dashboard is accepted.
- [ ] Verify links and the new palette in the packaged ALDY.app (browser smokes do not exercise the native shell).
