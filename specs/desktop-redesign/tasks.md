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
- [x] Decided 2026-11-02: keep the light sidebar.
- [x] Dashboard metric cards carry a status icon and a one-line plain explanation (user decision 2026-11-02).
- [ ] Plan progress ring and recent-problem cards (not requested yet).
- [x] Calendar side summary: today, the visible month and an 8-week attempt heatmap. Counts recorded attempts only, ignores calendar filters, hides while the inspector is open.
- [x] Company rows use initials badges, never logos (user decision 2026-11-02), with matched/solved counts and a 매칭 많은 순 / 이름순 sort (default: most matches).
- [ ] Apply card surfaces to analytics, contests and company pages after the dashboard is accepted.
- [ ] Verify links and the new palette in the packaged ALDY.app (browser smokes do not exercise the native shell).
- [x] ALDY app icon: an "A" whose crossbar is a check mark. Source `desktop/src-tauri/icons/source/aldy.svg`; sizes generated with `tauri icon`; the same mark replaces the sidebar monogram.
- [x] Code Workspace start panel: with no repository, the explorer and editor are replaced by three inline options (connect a local folder, clone from GitHub, create new) using the existing register/clone/create commands; the native shell adds a folder picker.
- [ ] GitHub one-click sign-in needs an OAuth/GitHub App client ID with device flow enabled, built in through `ALDY_GITHUB_CLIENT_ID` at compile time. Until then the Client ID field stays under 고급 and system Git credentials work for clone/push.
- [x] Company sort adds 대기업 순: an authored, dated IT market-cap/recognition order (`BIG_TECH_ORDER` in company.mjs), labelled as not live data; unlisted companies follow by matched count.

## Tableau palette and flatter dashboard (2026-11-03)

- [x] Primary and status colours switched to Tableau 10 (light and dark); app icon recoloured to match.
- [x] Dashboard numbers: one flat strip with hairline dividers and small coloured marks (replaces boxed cards with icon tiles).
- [x] Contest list: date group headers, platform edge and chip, phase chip; durations as 분 / 시간 / 日.
- [x] Analytics trend empty state spans the chart (was squeezed into the 24px axis column).
