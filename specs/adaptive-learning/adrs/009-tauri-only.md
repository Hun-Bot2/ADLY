# ADR 009: Tauri-only desktop shell

Status: accepted 2026-10-30 by explicit user choice to remove Electron. Supersedes ADR 007's dual-candidate selection/fallback rule, not its data/process/security ownership boundaries.

## Research and requirements

Before this change, Tauri imported bootstrap, native credential reader and askpass resources from desktop/electron/. These are Node runtime helpers, not Electron APIs. Electron main/preload/OS-safeStorage wrappers and its dependency/package scripts are exclusive to the discarded shell.

The app SHALL retain Tauri as its only native shell. Shared bootstrap, pinned standalone Node, native credential pipe restrictions, Git askpass capability and process shutdown MUST remain operational. Learner databases, datasets, source hashes and historical verification receipts MUST NOT be deleted. No recommendation or schema changes are required.

## Design and tasks

- [x] Move retained Node helpers to desktop/runtime/, measurement tool to desktop/measure.mjs and relevant tests to desktop/test/.
- [x] Update Tauri development/resource paths, packaging/audit, CI and active runbooks.
- [x] Remove Electron-specific source, dependencies, generated candidate bundles and tests.
- [x] Verify tests, package resources, native launch/journal/quit and onboarding; record results.

## Validation and risks

Use disposable fixtures; run desktop Node and Tauri Rust suites, rebuild and audit the Tauri package, run native onboarding and launch smoke. Moving bootstrap/askpass paths can break startup or authentication; preserve exact helper behavior and regression assertions. Shared helper tests survive, Electron-only adapter tests do not apply to Tauri and are removed. Historical comparisons remain evidence, not current supported commands.

## Consequences

Tauri is selected by user override, not an invented cross-platform benchmark win. Windows runtime verification, signed releases, native ownership migration, live account authentication and other existing release gates remain open. Runtime JS engine stays canonical; no Rust engine port follows from this choice.
