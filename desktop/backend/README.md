# Candidate desktop backend adapter

These Node modules implement the current Tauri-launched desktop adapter and its test harness. They remain JavaScript system adapters, not a completed Rust ownership migration. The JS engine remains the only
learner SQLite writer. No module here reads or writes learner SQLite.

- `repositories.mjs`: register/create/clone, authored problem templates, read/save/list files, preview/scoped commit.
- `paths.mjs`: canonical relative paths (symlinks and traversal rejected), atomic settings writes, OS app-data defaults.
- `drafts.mjs`: app-data draft persistence; saving a draft never edits a repository file.
- `dailylog.mjs`: append one result row while preserving CRLF and surrounding bytes.
- `runner.mjs`: detect toolchains, execute Python/C++17 with limits and authored tests. macOS/POSIX candidate only.
- `sync.mjs`: opt-in fetch/fast-forward, divergence and remote-history-rewrite stop, explicit push.

Windows execution uses the optional Rust Job Object helper in `desktop/native-runner/`; absent helper fails closed. Windows-only enforcement code still needs execution on Windows. macOS process groups have an EPERM fallback to
killing the direct child (possible in restricted environments); the result then reports
`process_tree_limit_enforced:false`. Memory is explicitly not enforced. This is an unsandboxed local runner.
Final release still requires per-OS native process/CPU/memory and credential-store evidence, repository mutexes across
app processes, stronger race-resistant file handles, native short-name/UNC checks on Windows, packaged lifecycle tests,
and packaged runtime measurement. The adapter is not DA-0 acceptance evidence.

Tests: `node --test desktop/test/backend.test.mjs`. Tests use authored synthetic fixtures and temporary repos only.

`createRemoteSync({loadRepositories})` provides opt-in periodic fetch/fast-forward; repository records use `sync_enabled`. Its `status()` preserves each repository's last sync time, result and error. No timer starts until `start()` is called.

`updates.mjs` provides a signed-update staging foundation. `createUpdater` pins an Ed25519 publisher public key and HTTPS
origin allowlist; `verify` authenticates the exact canonical manifest and checks schema, target, size and stable version.
`stage` requires explicit confirmation, accepts AbortSignal, disallows redirects, checks streamed byte count and SHA-256,
and atomically publishes a no-overwrite `.download` file under app-data updates. It never installs an update or touches
learner data. Publisher keys, manifest URL and signing credentials are never generated automatically. The native shell's
installer/updater, key rotation and clean-machine upgrade/rollback checks remain separate DA-7/DA-9 work.

Manifest envelope: `{manifest:{schema:1,version,platform,arch,url,sha256,size},signature}`. Sign the UTF-8 string returned
by `canonicalManifest(manifest)` with Ed25519, then encode the detached 64-byte signature as standard base64. Only stable
`major.minor.patch` versions are accepted in this foundation. Tests: `node --test desktop/test/updates.test.mjs`.
