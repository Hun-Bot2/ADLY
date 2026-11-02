# DA-0 candidate measurements (2026-10-29)

Current shell: **Tauri only**, selected by user override (ADR 009, 2026-10-30). Electron comparison/selection steps below are historical. Current runtime paths and verification: [Tauri-only migration](tauri-only.md). Historical measurement receipts are preserved.

Status: partial native-development evidence on Apple Silicon macOS. No final shell choice.
ADR 007 requires both OSes and packaged hard gates; Windows and installed-package evidence remain unmeasured.

Both candidates launch the existing JS desktop prototype under external Node 26.8.1. The shared bootstrap opens
`node:sqlite` before startup. New temporary learner directories were used; the real learner DB was not opened.
Local immutable catalog/company sources were supplied read-only. Native Rust ownership of repository mutations
and all process operations remains an integration gate: the prototype still owns those operations in JS.

| Executed evidence | Electron 45.1.0 | Tauri 2.12.5 |
|---|---:|---:|
| First HTML load, one run | 1,417 ms | 1,927 ms |
| First authenticated journal response, one run | 2,433 ms | 2,716 ms |
| Journal HTTP status / available | 200 / true | 200 / true |
| Idle observation | 60 s | 60 s |
| Owned process-tree RSS sum | 467,648,512 B | 179,126,272 B |
| Observed owned PIDs surviving automatic quit | 0 | 0 |
| Actual temporary OS credential write/read/delete | passed, async safeStorage | passed, native keyring |
| Installed size / installer size | unmeasured | unmeasured |
| Signed/notarized package | unmeasured | unmeasured |
| Windows | unmeasured | unmeasured |

RSS is **not a complete memory comparison**. Shared pages are counted multiple times, and system-managed macOS
WebKit processes can be outside the Tauri descendant tree. These numbers cannot select a framework. The two runs overlapped in wall-clock time, so CPU/memory contention was not controlled. Each timing
is one concurrent development observation, without controlled cold OS caches. HTML load and an API response do not establish the
first fully interactive journal render. Receipts record these limits explicitly.

Receipts: `receipts/da0-electron-macos-arm64.json`, `receipts/da0-tauri-macos-arm64.json`.
The first measurement attempt hit the newly required session-cookie guard (403); it remains under `/private/tmp/`
and was excluded from this table. The corrected script fetches the landing-page cookie in memory and never emits it.

The actual native GUI launch/quit smoke also ran for both candidates. Electron's captured document title was
`Algorithm Mastery · 학습 도구`; Tauri emitted its native page-finished event. These are development GUI observations,
not installation or interactive migration evidence. The temporary OS-store probes emitted only write/read/delete
booleans and deleted their authored temporary entries; no live GitHub sign-in was attempted.

Code validation: `node --test desktop/electron/test/*.test.mjs` passed 10 tests, covering credential-pipe rejection,
secret-free launchers, fake OS-store behavior, public auth handles, explicit import confirmation, read-only native
credential pipes, normal quit/restart and abrupt parent termination with an authored child subtree.
`cargo test --manifest-path desktop/src-tauri/Cargo.toml --offline` passed 3 tests and compiled native auth/dialog code.
Those unit tests do not replace packaged per-OS process, credential, import and runner checks.

Reproduction, resource layout and candidate package commands are in `desktop/electron/README.md`.


## Portable unsigned packaged smoke (supersedes runtime assumptions above)

The first copied Homebrew Node failed in Electron because `@rpath/libnode.147.dylib` was absent. Tauri's earlier current-host
success did not establish a self-contained runtime. Both apps were rebuilt with the same official standalone Node26.8.1
arm64 binary and its LICENSE; the archive matches the publisher's HTTPS SHA-256. Release-signature verification is not
claimed. `receipts/node-runtime-darwin-arm64.v1.json` records provenance.

Both unsigned `.app` executables then launched from their packaged resources, copied the explicit catalog/company layers
into new temporary app-data directories, returned journal 200/available:true, exited 0 and left zero observed owned PIDs.
The 2-second hold is a packaged smoke, not a 60-second idle benchmark or clean-machine installation. Full resource and
Electron archive audits match staged/source hashes and find no learner DBs, credentials, CSVs or research directories.
Receipts: `receipts/{electron,tauri}-packaged-macos.v2.json`, corresponding package-audit receipts. Earlier packaged v1
Tauri observations remain historical current-host evidence and are superseded for portable-runtime claims.

electron: installed logical bytes 687465001 (symlinks not double-counted; installer size unmeasured).

tauri: installed logical bytes 433599728 (symlinks not double-counted; installer size unmeasured).
