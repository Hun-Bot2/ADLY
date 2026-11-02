# Iteration 4: CP-1 builder foundation (2026-10-29)

Implemented `research/company_prep/build_company_layer.py` and its authored synthetic fixture test.
The stdlib builder verifies clean pinned Git HEAD and the catalog receipt hash, normalizes URLs,
resolves catalog aliases, retains unmatched slugs, preserves source row ranks and per-file hashes,
and emits an immutable versioned SQLite layer and aggregate receipt. Acceptance Rate and topics
are not stored. Duplicate canonical keys retain the first row and are counted. Unknown filenames
and headers fail closed. Output directories must not already exist.

For deterministic output bytes, `built_at` currently uses the upstream commit timestamp, disclosed
in the receipt's `build_time_policy`. Actual build time is separate from reproducible database metadata;
the receipt additionally records actual wall-clock build time in `executed_at`.

Validation executed: `python3 -m unittest discover -s research/company_prep -v` (1 test passed,
covering URL case/query/fragment/trailing slash, alias, unmatched slug, malformed row, header-only,
difficulty disagreement, deterministic bytes, overwrite refusal and input integrity guards).
`git diff --check` passed. Learner data and pinned catalogs were not modified.

CP-1 remains incomplete: the audit's temporary upstream checkout is unavailable; real pinned-data
build and aggregate receipt reproduction have not run. No runtime company loading or desktop shell
was implemented. Next: acquire the pinned checkout, reproduce audit aggregates, then CP-2. DA-0
remains a separate shell comparison task with macOS and Windows measurement requirements.

Attempted to restore the upstream checkout using git clone; network DNS resolution for github.com failed.
