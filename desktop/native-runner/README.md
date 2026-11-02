# Windows local runner helper

This crate implements a Windows x64 Job Object runner for the candidate desktop adapter. It is not a sandbox.
It accepts one JSON request on stdin and emits one JSON result on stdout. Node supplies a validated toolchain command,
argument array, temporary cwd, input and limits. No command shell is invoked.

`Request` fields: `command`, `args`, `cwd`, `input` (default empty), `timeoutMs` (default 5000), `cpuSeconds` (5),
`memoryBytes` (512 MiB), `outputLimit` (1 MiB, combined stdout + stderr). Rust repeats all size and limit validation.
The process is created suspended, assigned to a Job, then resumed. The non-inherited Job handle is held only by this
helper. Closing it (including helper termination) kills all descendants. Limits apply to per-process and total Job
CPU and committed memory; the parent loop enforces wall time and output. Successful parent exit also terminates
remaining descendants before returning. The helper uses no credentials or learner database.

Build: `cargo build --release --locked --manifest-path desktop/native-runner/Cargo.toml`.
Tests: `cargo test --locked --manifest-path desktop/native-runner/Cargo.toml`.
Set `MASTERY_NATIVE_RUNNER` to the helper's absolute path, or pass `nativeRunnerPath` to `runFile`/`execute`.
Windows tests need Python 3 (`python.exe`, override `MASTERY_TEST_PYTHON` with an absolute path).

Verified on Apple Silicon: four platform-independent request/quoting/fail-closed tests. Windows-only code has not
been compiled or executed in this checkout; the Windows CI job must establish ABI, process-tree, memory, CPU and
output-limit evidence. A packaged app must include the release helper and verify its hash; an arbitrary environment
path is a developer mechanism, not the final distribution contract. Windows parent-shell crash behavior also requires
packaged smoke testing (the helper's own death closes its Job, but a Node shell dying alone must also stop the helper).

Primary API references:
- https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
- https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information
- https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information
- https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw
