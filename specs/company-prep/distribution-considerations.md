# Company metadata: distribution considerations (register)

Tracked separately by user decision (2026-10-29). Open items do not block implementation or change the user experience.
Each item must be resolved or explicitly accepted by the user before a public release that includes the company layer.

| ID | Consideration | Evidence | Status | Possible resolution |
|---|---|---|---|---|
| DC-1 | Upstream repository has no licence; GitHub's terms allow viewing and forking on GitHub but grant no redistribution licence | GitHub API `license: null` (2026-10-29) | Open | Ask the author for a licence or written permission |
| DC-2 | Upstream describes itself as based on LeetCode company tags (a Premium feature); LeetCode terms restrict scraping and reuse of content | Repository description; `research/full_catalog/terms-review.v1.json` | Open | Legal review of LeetCode terms for factual lists; LeetCode permission |
| DC-3 | The shipped layer contains only keys, company names, windows, rank and frequency (no statements, titles or acceptance data) | ADR 008 decision 4 | Mitigation in place | Keep the minimal schema |
| DC-4 | Company names may be trademarks; the UI uses them only to identify | distribution-rights report (trademarks) | Open | Avoid logos; identification-only wording |
| DC-5 | The LeetCode catalog itself has unresolved distribution rights (S2) | `specs/distribution-rights/report.md` | Open (pre-existing) | As for the catalog release blocker |
| DC-6 | Frequency is upstream-derived and its semantics are undocumented; misinterpretation risk | Audit | Mitigated in UI copy (CR13, CR15) | — |

Changes to this register are recorded with a date and source. This register is not legal advice.
