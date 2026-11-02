# Desktop redesign requirements

- R1 THE SYSTEM SHALL provide one primary navigation: Dashboard, Calendar, Explorer, Analytics, Contests, Company,
  Research, Code Workspace; settings/repositories/accounts/backups SHALL remain secondary. History SHALL remain fully
  searchable/filterable/editable through Explorer, calendar and problem details without a standalone primary nav item.
- R2 THE SYSTEM SHALL use local Pretendard UI and JetBrains Mono code fonts, centralized typography/spacing, white/
  near-white surfaces, charcoal text, and the specified Tableau10 palette for semantic data only. Fonts SHALL work offline.
- R3 Dashboard SHALL be the default and SHALL show next action, actual completions, due/overdue work and concise recent
  context above the fold. It SHALL NOT embed a full month calendar or count plans as completed activity.
- R4 Calendar SHALL provide month/week, date details without route navigation, type/platform filters, keyboard navigation,
  bounded marks and overflow for dense days; all entries SHALL remain reachable.
- R5 Analytics SHALL derive from recorded data with explicit denominators, missingness and separately identified duration
  sources. Charts SHALL support useful hover/focus/selection/drilldown. No mastery scores or durations SHALL be invented.
- R6 Contests SHALL offer upcoming/ongoing/past tabs, platform filters, local times/duration/source/actions and unchanged sync.
- R7 Company SHALL preserve matching/recommendation contracts while showing source coverage, historical outcomes, topic/
  difficulty structure, clear uncalibrated estimates and mock actions in a compact workspace.
- R8 Code Workspace SHALL be editor-first with persistent resizable/collapsible panels, shortcuts, test/output/record/Git
  actions and secondary settings. Existing filesystem, execution, credential, origin/token and repository safety SHALL hold.
- R9 Research SHALL preserve source/proxy behaviors and visibly distinguish similarity from recommendation evidence.
- R10 All primary pages SHALL be visually inspected at 1280x800 and 1440x900 with functional regression and Tauri build
  evidence. Insufficient/missing data SHALL produce compact honest states. No release completion claim follows from build alone.
