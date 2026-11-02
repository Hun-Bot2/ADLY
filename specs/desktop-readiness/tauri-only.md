# Tauri-only migration (2026-10-30)

The user explicitly selected Tauri and requested removal of the Electron candidate. ADR 009 supersedes ADR 007's comparison/fallback rule. This is a user choice, not a claim that every release gate or benchmark passed.

## Changes

- Removed desktop/electron/: Electron main/preload, Electron safeStorage/auth/first-run wrappers, package/lock files, Electron-only tests, installed Electron/build dependencies and generated candidate app. No system-wide npm cache or unrelated application was removed.
- Preserved bootstrap, bounded native credential reader, Git askpass broker/helper and lifecycle test launcher in desktop/runtime/. Relevant credential/shutdown tests now run in desktop/test/.
- Moved the measurement script to desktop/measure.mjs, Tauri-only with --candidate tauri optional.
- Updated Tauri development bootstrap, resource mappings, stage allowlist and package auditor. Legacy ASAR archives are rejected by the Tauri package audit rather than requiring Electron's ASAR dependency.
- Removed Electron installation/packaging from the fixture CI workflow. The workflow remains unobserved remotely.
- Updated active runbooks and shell decision. Earlier comparison receipts and historical implementation notes remain unchanged as historical evidence.

No learner database, immutable catalog/company source, recommendation logic, execution boundary, authentication protocol or user repository was changed. The pinned standalone Node runtime remains required by Tauri's existing JS engine. Rust/system ownership migration is still a separate gate.

## Executed validation

| Check | Result |
| --- | --- |
| `node --test desktop/test/*.test.mjs` | 41 passed, including moved askpass/native-store/lifecycle tests |
| `cargo test --manifest-path desktop/src-tauri/Cargo.toml --locked` | 6 passed |
| `npm run package --prefix desktop/src-tauri` | macOS arm64 unsigned app built without desktop/electron/ |
| Package audit against rebuilt resources | 115 files verified, no forbidden data |
| Source/resource path scan | No Electron directory or old Electron runtime path in current source/CI or package resource tree |
| Packaged native new/cancel/close | 3 cases passed; no observed owned survivors |
| `node desktop/measure.mjs ... --seconds 2` | journal HTTP 200 and available; exit 0; no observed owned survivors |
| `git diff --check` | Passed |

Receipts: [launch](receipts/tauri-only-launch.json), [onboarding](receipts/tauri-only-onboarding.json), [package audit](receipts/tauri-only-package-audit.json).

All learner writes were confined to new disposable test directories. Packaged catalog/company metadata was read from the supplied immutable versions. No live GitHub login, remote Git operation or provider generation was invoked. Windows host behavior, signing/notarization and full native ownership remain open. No UI or learner-engine code changed in this cleanup, so frontend/Python/engine suites were not repeated; earlier receipts remain historical.

Run/build instructions: desktop/README.md. The rebuilt app remains at:

`desktop/src-tauri/target/release/bundle/macos/Algorithm Mastery DA0 Tauri.app`

Suggested commit: `refactor(desktop): remove Electron and retain Tauri runtime helpers`.
No commit or push was performed. Unrelated working-tree work was preserved.
