# Modal and inspector requirements

- R1 The system SHALL use a nonmodal inspector for problem/review/attempt/catalog browsing, preserving browsing context and every existing action and evidence record.
- R2 The inspector SHALL group header, learning, review, saved AI explanations and collapsed recommendation evidence. It MUST NOT infer model availability or generate on read.
- R3 Focused input tasks SHALL remain modal, with one primary action, named dismiss controls, initial focus, contained Tab/Shift+Tab, Escape and logical focus return.
- R4 Dirty forms MUST NOT be silently discarded by Escape, backdrop, close or replacement. Only one modal SHALL be presented at a time.
- R5 Related content SHALL use shared 24/12/8px spacing and readable wrapping; long data SHALL remain reachable. Nonmodal inspectors MUST NOT make background inert or trap focus.
- R6 Playwright SHALL verify actual supported frontend at 1440×900,1280×800,1024×720, with before/after, available/unavailable explanations, long strings and keyboard states. Native verification SHALL be reported separately.
