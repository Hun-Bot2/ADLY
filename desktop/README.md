# ALDY — Algorithm Daily (desktop)

The existing learning engine is retained. Company preparation is implemented in `hosted/`; desktop repository/editor tools
are executable through the loopback development adapter. Tauri under `src-tauri/` is the selected native shell by user decision (ADR 009). Node runtime helpers live in `runtime/`; Electron source, dependencies and packaging have been removed. This remains an unsigned development app, not a certified release.

## Run the tools preview

Requires Node 26.8.1 with built-in SQLite and system Git. Python 3 and a C++ compiler are detected when running code.

```sh
npm ci --prefix desktop --ignore-scripts
npm run build --prefix desktop
node desktop/dev.mjs
```

The command prints the loopback URL. It creates a separate learner database in the OS app-data directory
(`~/Library/Application Support/AlgorithmMastery` on macOS, `%APPDATA%\AlgorithmMastery` on Windows).
Use `DESKTOP_APP_DATA=/absolute/new/directory node desktop/dev.mjs` for an isolated preview.
The development catalog root is the existing private mastery directory, attached read-only. A fresh learner selects the
newest available catalog automatically. The tools panel can explicitly select another version.
Do not launch a candidate against real learner data for tests.

Open the existing workspace or use **코드 · 실행 · 기록**:
connect/create/clone a repository; open a problem; edit in CodeMirror; save; run user-authored tests; record a result;
review the diff; commit selected paths. Only local commits feed ingestion. Push is an explicit separate action.
An imported solution must exist in the catalog before the engine accepts a daily log entry. Conflicting rows are rejected
before saving. A successful commit with failed ingestion remains a successful commit; retry ingestion rather than commit.

Drafts persist in app data independently of repository saves. Every run executes the saved file. Runs are not sandboxed;
macOS memory is not enforced. Windows requires the native Job Object helper:

```sh
cargo build --release --manifest-path desktop/native-runner/Cargo.toml --locked
```

Set `MASTERY_NATIVE_RUNNER` to the absolute `.exe` path during Windows development. Packaged candidates must ship it.

## Existing learner data: explicit first-run copy

Before launching against a **new** app-data directory, explicitly copy the existing database:

```sh
node desktop/import.mjs --source /absolute/source.sqlite3 --app-data /absolute/new/app-data --confirm
```

This uses a read-only SQLite connection and `VACUUM INTO` for a WAL-consistent snapshot. It refuses an existing destination.
It never runs migrations on or modifies the source. The explanation cache and catalogs are separate; this command copies
only the learner database. Tauri includes a new/copy/cancel dialog and file picker; actual interactive copy acceptance still needs an installed-app check.

## Validation

```sh
node --test hosted/test/*.test.mjs
python3 -m unittest discover -s tests -v
python3 -m unittest discover -s research/company_prep -v
node --test desktop/test/*.test.mjs
cargo test --manifest-path desktop/native-runner/Cargo.toml --locked
node desktop/browser-smoke.mjs
node hosted/company-browser-smoke.mjs
```

Browser smokes use Chrome and only authored fixtures, temporary solution repos and temporary learner databases.
Socket-based tests need loopback access. Candidate shell lifecycle/credential tests have their own package commands.

## Stage unsigned candidates

Build the UI first, then stage only allowlisted runtime sources and the pinned Node executable:

```sh
node desktop/package-stage.mjs --output desktop/stage --node-binary /path/to/portable/node
```

Use the matching official Node26.8.1 standalone release and verify its publisher SHA-256 before staging.
Homebrew Node can depend on external `libnode`; the stager rejects it. The runtime license must be adjacent to the official
installation and is copied into the bundle. Runtime download provenance is recorded under specs/desktop-readiness/receipts/.
To include private, reviewed dataset versions, add explicit `--dataset /path/to/catalog-vN` and
`--dataset /path/to/company-vK`. Only the database and aggregate receipt are copied, with hash verification.
Never archive a repository root. Stage output, dependencies, compiled helpers and installers are ignored by Git.
`DESKTOP_PACKAGED=1` copies shipped datasets into app data with hash verification; existing immutable versions are never
replaced. See the Tauri commands below for unsigned builds. Distribution considerations still require user review.

## macOS DMG

After `npm run package` in `desktop/src-tauri`, run `desktop/package-dmg.sh` from the repository root. It writes
`desktop/src-tauri/target/release/bundle/dmg/ALDY-macos-arm64.dmg` (the README download name). `tauri build --bundles dmg`
also works on a normal desktop session; in headless sessions its Finder AppleScript times out. A Windows `.exe` (NSIS,
`npm run package:windows`) must be built on Windows with the Windows Node runtime and native runner helper.

## GitHub sign-in (one-time maintainer setup)

The app signs in with GitHub's device flow, which needs a public client ID (there is no secret):

1. github.com → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Name `ALDY`, homepage and callback URL can both be `https://github.com/<you>/Algorithm-RAG-Engine` (unused by the device flow).
3. After creating it, tick **Enable Device Flow** and save.
4. Put the Client ID (e.g. `Ov23li...`) in `desktop/src-tauri/github-client-id.txt`, or set `ALDY_GITHUB_CLIENT_ID` for one build.
5. Rebuild the app. The start panel then shows **GitHub로 로그인**; sign-in asks for the `repo` scope.

Without a client ID, cloning by HTTPS URL and push still work through the computer's own Git credentials.

## Open release gates

Final Rust/system ownership; broader native lifecycle and first-run acceptance;
Windows-host execution; installed-app end-to-end checks; signed installers and update installation. Native GitHub login
requires the registered OAuth App client id (see above). Certificates, account registration and final distribution review are user work.
A checked-in CI workflow is not a remote green run. An unsigned candidate is not a release.

## Signed update staging

A channel is off until `DESKTOP_UPDATE_PUBLIC_KEY` (Ed25519 PEM), `DESKTOP_UPDATE_ORIGIN` (HTTPS origin) and
`DESKTOP_UPDATE_MANIFEST_URL` are configured. The tools UI verifies a manifest, then explicitly downloads a newer matching
artifact. Signatures, platform/architecture, bounded size and SHA-256 are verified; files are staged without installation.

The publisher's offline command is `node desktop/sign-update.mjs --artifact <file> --version <major.minor.patch>
--platform <darwin|win32> --arch <arm64|x64> --url <https URL> --private-key <private PEM file> --output <new manifest>`.
Keep private keys outside the repo. Native installer handoff and signed update activation remain release integration work.

## First-run close regression

Tauri first-run choices are now in an owned app window. Closing it or choosing cancel exits the app; native file selection
and copy confirmation belong to that window. The startup worker cannot reopen the app after exit. Native verification:
`node desktop/onboarding-smoke.mjs --binary <packaged Tauri executable>`. See iteration-6.md for scope and receipts.

## Tauri build and measurement

After staging:

```sh
npm ci --prefix desktop/src-tauri
npm run package --prefix desktop/src-tauri
# Windows host: npm run package:windows --prefix desktop/src-tauri
cargo test --manifest-path desktop/src-tauri/Cargo.toml --locked
node desktop/measure.mjs --executable "/absolute/path/to/app/executable" --app-data /absolute/new/test-data --seconds 2
```

Only stage reviewed datasets explicitly; no real learner data belongs in packages or fixture tests. The measurement tool defaults to Tauri. Packaged runtime files preserve credential isolation and shutdown handling. See specs/desktop-readiness/tauri-only.md for migration verification.

## Display name

The app is now **ALDY (Algorithm Daily)**. Open the current macOS build with:

```sh
open "desktop/src-tauri/target/release/bundle/macos/ALDY.app"
```

App identifier, credentials namespace and AlgorithmMastery app-data path are intentionally preserved for compatibility; renaming does not reset or move learner data. The internal executable name remains unchanged. Historical receipts use the old product name.
