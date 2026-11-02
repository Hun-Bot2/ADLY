# Iteration 5: company preparation and desktop implementation batches

Date: 2026-10-29. Source contracts: desktop-app/, company-prep/, ADR007/008. This iteration implements executable
batches while retaining the cross-OS shell-selection and installed-release gates. Existing learner data was not used
for tests. No push, remote workflow execution or signed release was performed.

## Implemented behavior

- CP-1: immutable company builder v2, pinned Git/catalog integrity, URL/alias matching, unmatched records, aggregate
  receipts, failure cleanup and reproducibility. Actual company-v2 reproduces 470 companies, 3,396 slugs, 2,794 matches,
  602 unmatched slugs, 1,227 empty files and one difficulty disagreement. Repeated actual build has the identical DB SHA.
  Company-v1 remains byte-identical. Actual execution time is in the receipt; DB build timestamp uses the commit time
  for reproducibility. Private upstream CSVs and generated databases remain uncommitted.
- CP-2/3: hash-verified read-only layer loading, additive company focus, explainable scoped progression and labeled general
  fallback, no company transfer lane, independent company mock snapshots, company search/progress/provenance UI and badges.
- Engine boundary: API-only mode, per-launch token/origin checks, health, explicit roots, catalog selection, daily-log
  validation, local repository registration and ingestion. Opt-in daily while-running contest sync persists its status.
- Desktop tools: CodeMirror Python/C++ editor, repository create/register/GitHub clone, authored solution templates, durable
  drafts, explicit saves, user-authored tests, readable results, cancel, daily record preview/validation, scoped diff/commit,
  opt-in fetch/fast-forward and manual push. A commit remains successful when subsequent ingestion fails.
- Process/data foundations: crash/restart supervisor, owned-run cancellation on shutdown, OS app-data defaults, explicit
  first-run SQLite-consistent copy, immutable dataset copying and strict path handling. Code runs cannot inherit provider
  keys or Git credential broker capabilities. macOS runs have CPU/wall/output limits; memory is explicitly not enforced.
- Windows runner: Rust Job Object helper, memory/CPU/time/output limits, child-tree cleanup; Windows-target code and tests
  cross-compile. Windows-host execution remains unverified.
- Native candidate shells: Tauri and Electron, first-run new/copy/cancel dialogs, OS-backed credentials, private device-flow
  handles and Git askpass pipes. Both passed native development GUI/credential probes on this Mac. Live GitHub sign-in
  needs the user's App registration; fake-flow tests do not prove live credentials.
- Updates: offline publisher signer and pinned Ed25519/HTTPS client verification with bounded, atomic download staging.
  The UI has explicit check/download actions. Native installation and signed update activation are not implemented.
- Packaging/CI: exact source/data staging, hash and forbidden-content audits, unsigned candidates; fixture-only macOS/Windows
  CI definition. The workflow source has not been pushed or observed remotely.

## Validation

Receipts: `receipts/implementation-validation.v1.json` and browser receipts. Engine298/298, desktop32/32, candidateJS11/11,
Python74/74, company builder1/1, native-runner Rust4/4, Tauri Rust3/3. Windows-target native-runner checks include tests;
those Windows tests were not executed. Chrome: desktop11 interactions, company6 interactions, existing workspace3 scenarios,
all passed with no observed runtime exceptions. Asset verification: seven verified and one explicitly missing. Map
preservation:501 files and all checks passed. Worker deploy dry-run passes; no deployment occurred.

Three authored no-company progression scenarios match the pre-company implementation byte-for-byte. Existing v1 policy
fingerprint remains frozen. Source-code provenance intentionally changes the v2 journal implementation hash, so this does
not claim byte identity of historical serialized journal snapshots across code versions. Native/local parity must use the
same code and inputs (DR-I3).

## Architecture impact and remaining implementation

The JS engine is still the sole learner SQLite writer. The Node desktop adapter owns repository operations in both
candidate spikes; this is not the final Rust ownership implementation if Tauri is selected. API-only mode is tested,
but the current native candidates host the inherited workspace through the loopback prototype and its session cookie.
Final bundled-UI/native-IPC trust boundaries remain to integrate after DA-0 selection. Loopback prototype tokens protect
browser-origin requests and are not a hostile-local-process security boundary.

The first-run native dialog code compiles and Electron's fake-dialog tests pass; actual picker/copy interaction still needs
an installed-app check. Other remaining code/integration work: final shell ownership, native installer/update handoff,
Windows packaged execution and complete per-OS end-to-end acceptance. These are not falsely classified as user-only work.

User/account work: register the GitHub App/client id, provide signing/notarization certificates, and review the distribution
considerations. Cross-platform clean-host testing needs an available host; the current Mac cannot prove Windows behavior.

Commit suggestions (not performed): company builder; company policy and UI; desktop tools/native runner; native candidates
and auth; packaging/CI/validation documentation. Keep generated datasets, packages and dependencies outside Git.


## Packaging lessons

A first Electron package could not load the copied Homebrew Node (`libnode.147.dylib`). A current-Mac Tauri success had
resolved local libraries and was not portable-runtime proof. The stager now rejects that dependency shape and accepts an
explicit matching official standalone Node binary; its license is shipped. The official archive matched the publisher's
HTTPS checksum (no release-signature verification is claimed). Native diagnostic output is bounded and classified so
startup failures are visible without exposing raw provider output. Stale generated Tauri resource copies must be removed
before replacing a bundled executable; never remove source datasets or learner data.


## Final unsigned package receipts

Both latest Mac candidates use the publisher-checksummed official standalone runtime and include its license. Packaged
launch/journal/quit smokes pass for both (HTTP200, available:true, exit0, no observed owned survivors). Both resource audits
pass; Electron archive source hashes also match. See portable v2 receipts in da-0-measurements.md. These are direct
unsigned `.app` executable launches on this Mac, not signed installer, clean-host migration or Windows proof.

Suggested logical commit messages:
- `feat(company): build immutable company metadata layers`
- `feat(mastery): add scoped company practice and preparation views`
- `feat(desktop): add editor runner and repository workflows`
- `feat(desktop): add native candidate shells and secure Git authentication`
- `chore(desktop): add package audits CI and implementation receipts`
