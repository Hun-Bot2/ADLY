# Iteration 6: first-run window and application exit (2026-10-29)

User reported the "학습 기록 시작 / 기존 기록 복사" alert remaining after closing the app. Inspection found the startup
choice implemented as an unparented blocking native dialog, before a managed Webview window existed. A matching old
native app process remained alive; it was terminated after checking the exact executable path. No learner DB was modified.

## Change

`desktop/src-tauri/src/main.rs` now creates an owned onboarding Webview (`placeholder/onboarding.html`) for new/copy/cancel.
Closing an onboarding or main app window requests application exit. Programmatic onboarding destruction after opening the
main window bypasses that user close event. There is no standalone first-choice alert or standalone startup-error alert.
File selection and copy confirmation have the onboarding window as their parent; failures are presented inline.

`src/lifecycle.rs` rejects duplicate start choices and prevents startup after shutdown. The flow checks shutdown after
file selection, confirmation, copy and engine startup. An in-progress import is bounded and stopped on cancellation.
The existing Node supervisor shutdown remains responsible for owned engine/code-run cleanup.
`build.rs` adds only the local onboarding command permission; remote auth commands retain their existing scope.

## Validation executed

- `cargo test --manifest-path desktop/src-tauri/Cargo.toml --locked`: 6/6 passed, including three shutdown/startup race tests.
- Rebuilt the unsigned Mac app at its existing path.
- `node desktop/onboarding-smoke.mjs --binary <packaged executable>`: actual native close, cancel and new-learner UI paths
  passed on macOS arm64. Close/cancel created no learner DB and opened no engine UI. New opened the main window and created
  only a disposable fixture learner. All paths exited0 with no observed owned PIDs remaining.
- Receipt: `receipts/onboarding-close-macos.v1.json`. The test uses temporary app data and does not automate file-picker
  interaction or establish Windows behavior. Existing Node/engine suites were not rerun: this fix changes only native
  onboarding/lifecycle and the native regression script. `git diff --check` passes.

The generated Tauri resource copies needed the documented pre-rebuild cleanup after a Mach-O copy permission error;
only target/release/{runtime-node,runtime,prototype,datasets} were removed, not source data.

Architecture: no learner schema, recommendation policy or stored history change. The app remains an unsigned candidate.
Suggested commit: `fix(desktop): own startup window and cancel startup on exit`.
