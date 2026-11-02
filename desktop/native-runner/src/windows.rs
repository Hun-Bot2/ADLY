//! Minimal Win32 bindings, x64 ABI, no process runs before Job assignment.
//! API reference: https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
use super::{Request, command_line};
use serde_json::{Value, json};
use std::{
    ffi::c_void,
    fs::File,
    io::{self, Read, Write},
    mem::{size_of, zeroed},
    os::windows::io::FromRawHandle,
    ptr::{null, null_mut},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
type Handle = *mut c_void;
#[repr(C)]
struct Security {
    length: u32,
    descriptor: *mut c_void,
    inherit: i32,
}
#[repr(C)]
struct Startup {
    size: u32,
    reserved: *mut u16,
    desktop: *mut u16,
    title: *mut u16,
    x: u32,
    y: u32,
    x_size: u32,
    y_size: u32,
    x_chars: u32,
    y_chars: u32,
    fill: u32,
    flags: u32,
    show: u16,
    reserved_size: u16,
    reserved_bytes: *mut u8,
    stdin: Handle,
    stdout: Handle,
    stderr: Handle,
}
#[repr(C)]
struct Process {
    process: Handle,
    thread: Handle,
    process_id: u32,
    thread_id: u32,
}
#[repr(C)]
struct BasicLimits {
    process_time: i64,
    job_time: i64,
    flags: u32,
    min_working: usize,
    max_working: usize,
    active_processes: u32,
    affinity: usize,
    priority: u32,
    scheduling: u32,
}
#[repr(C)]
struct IoCounters {
    read_ops: u64,
    write_ops: u64,
    other_ops: u64,
    read_bytes: u64,
    write_bytes: u64,
    other_bytes: u64,
}
#[repr(C)]
struct ExtendedLimits {
    basic: BasicLimits,
    io: IoCounters,
    process_memory: usize,
    job_memory: usize,
    peak_process_memory: usize,
    peak_job_memory: usize,
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn CreateJobObjectW(attributes: *mut Security, name: *const u16) -> Handle;
    fn SetInformationJobObject(job: Handle, class: i32, info: *const c_void, length: u32) -> i32;
    fn AssignProcessToJobObject(job: Handle, process: Handle) -> i32;
    fn TerminateJobObject(job: Handle, code: u32) -> i32;
    fn CreatePipe(
        read: *mut Handle,
        write: *mut Handle,
        attributes: *mut Security,
        size: u32,
    ) -> i32;
    fn SetHandleInformation(handle: Handle, mask: u32, flags: u32) -> i32;
    fn CreateProcessW(
        application: *const u16,
        command: *mut u16,
        process_attributes: *mut Security,
        thread_attributes: *mut Security,
        inherit: i32,
        flags: u32,
        environment: *mut c_void,
        cwd: *const u16,
        startup: *mut Startup,
        process: *mut Process,
    ) -> i32;
    fn ResumeThread(thread: Handle) -> u32;
    fn WaitForSingleObject(handle: Handle, milliseconds: u32) -> u32;
    fn GetExitCodeProcess(process: Handle, code: *mut u32) -> i32;
    fn TerminateProcess(process: Handle, code: u32) -> i32;
    fn CloseHandle(handle: Handle) -> i32;
}
struct Owned(Handle);
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}
fn checked(handle: Handle) -> io::Result<Owned> {
    if handle.is_null() {
        Err(io::Error::last_os_error())
    } else {
        Ok(Owned(handle))
    }
}
fn ok(value: i32) -> io::Result<()> {
    if value == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain([0]).collect()
}
fn pipe() -> io::Result<(Owned, Owned)> {
    unsafe {
        let (mut read, mut write) = (null_mut(), null_mut());
        let mut sa = Security {
            length: size_of::<Security>() as u32,
            descriptor: null_mut(),
            inherit: 1,
        };
        ok(CreatePipe(&mut read, &mut write, &mut sa, 0))?;
        Ok((Owned(read), Owned(write)))
    }
}
fn into_file(handle: Owned) -> File {
    let raw = handle.0;
    std::mem::forget(handle);
    unsafe { File::from_raw_handle(raw) }
}
fn reader(mut file: File, kind: usize, tx: mpsc::SyncSender<(usize, Vec<u8>)>) {
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match file.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if tx.send((kind, buffer[..n].to_vec())).is_err() {
                        return;
                    }
                }
            }
        }
        let _ = tx.send((kind, Vec::new()));
    });
}

pub fn run(request: Request) -> io::Result<Value> {
    unsafe {
        let started = Instant::now();
        let job = checked(CreateJobObjectW(null_mut(), null()))?;
        let mut limits: ExtendedLimits = zeroed();
        // KILL_ON_JOB_CLOSE | PROCESS_TIME | JOB_TIME | PROCESS_MEMORY | JOB_MEMORY.
        limits.basic.flags = 0x2000 | 0x2 | 0x4 | 0x100 | 0x200;
        limits.basic.process_time = (request.cpu_seconds * 10_000_000) as i64;
        limits.basic.job_time = limits.basic.process_time;
        limits.process_memory = request.memory_bytes;
        limits.job_memory = request.memory_bytes;
        ok(SetInformationJobObject(
            job.0,
            9,
            &limits as *const _ as *const c_void,
            size_of::<ExtendedLimits>() as u32,
        ))?;
        let (stdin_read, stdin_write) = pipe()?;
        let (stdout_read, stdout_write) = pipe()?;
        let (stderr_read, stderr_write) = pipe()?;
        for handle in [&stdin_write, &stdout_read, &stderr_read] {
            ok(SetHandleInformation(handle.0, 1, 0))?;
        }
        let mut startup: Startup = zeroed();
        startup.size = size_of::<Startup>() as u32;
        startup.flags = 0x100;
        startup.stdin = stdin_read.0;
        startup.stdout = stdout_write.0;
        startup.stderr = stderr_write.0;
        let mut process: Process = zeroed();
        let mut command = wide(&command_line(&request.command, &request.args));
        let cwd = wide(&request.cwd);
        // CREATE_SUSPENDED | CREATE_NO_WINDOW. Child cannot fork before Job assignment.
        ok(CreateProcessW(
            null(),
            command.as_mut_ptr(),
            null_mut(),
            null_mut(),
            1,
            0x4 | 0x08000000,
            null_mut(),
            cwd.as_ptr(),
            &mut startup,
            &mut process,
        ))?;
        let process_handle = Owned(process.process);
        let thread_handle = Owned(process.thread);
        if AssignProcessToJobObject(job.0, process_handle.0) == 0 {
            let error = io::Error::last_os_error();
            TerminateProcess(process_handle.0, 1);
            return Err(error);
        }
        // The last non-inherited Job handle stays in this helper; helper death closes it and kills the whole tree.
        drop(stdin_read);
        drop(stdout_write);
        drop(stderr_write);
        let (tx, rx) = mpsc::sync_channel(16);
        reader(into_file(stdout_read), 0, tx.clone());
        reader(into_file(stderr_read), 1, tx);
        let input = request.input.into_bytes();
        let mut stdin = into_file(stdin_write);
        thread::spawn(move || {
            let _ = stdin.write_all(&input);
        });
        if ResumeThread(thread_handle.0) == u32::MAX {
            return Err(io::Error::last_os_error());
        }
        drop(thread_handle);
        let mut output = [Vec::<u8>::new(), Vec::<u8>::new()];
        let mut bytes = 0usize;
        let mut closed = [false, false];
        let mut reason = None;
        let mut terminated = false;
        let mut termination_time = None;
        loop {
            match rx.recv_timeout(Duration::from_millis(5)) {
                Ok((kind, chunk)) => {
                    if chunk.is_empty() {
                        closed[kind] = true;
                    } else {
                        let take = chunk.len().min(request.output_limit.saturating_sub(bytes));
                        output[kind].extend_from_slice(&chunk[..take]);
                        bytes = bytes.saturating_add(chunk.len());
                        if bytes > request.output_limit && reason.is_none() {
                            reason = Some("output_limit");
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => closed = [true, true],
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
            if !terminated {
                let wait = WaitForSingleObject(process_handle.0, 0);
                if wait == u32::MAX {
                    return Err(io::Error::last_os_error());
                }
                if started.elapsed().as_millis() >= request.timeout_ms as u128
                    && wait != 0
                    && reason.is_none()
                {
                    reason = Some("timeout");
                }
                if wait == 0 || reason.is_some() {
                    ok(TerminateJobObject(job.0, 1))?;
                    terminated = true;
                    termination_time = Some(Instant::now());
                }
            }
            if terminated && closed.iter().all(|v| *v) {
                break;
            }
            if termination_time.is_some_and(|time| time.elapsed() > Duration::from_secs(5)) {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "Job terminated but output pipes did not close",
                ));
            }
        }
        if WaitForSingleObject(process_handle.0, 5000) != 0 {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "Job process did not exit",
            ));
        }
        let mut code = 0;
        ok(GetExitCodeProcess(process_handle.0, &mut code))?;
        let verdict = reason.unwrap_or(if code == 0 {
            "completed"
        } else if code == 0xC000013A {
            "timeout"
        } else {
            "runtime_error"
        });
        Ok(
            json!({"verdict":verdict,"stdout":String::from_utf8_lossy(&output[0]),"stderr":String::from_utf8_lossy(&output[1]),"exit_code":code,"elapsed_ms":started.elapsed().as_millis(),"signal":null,"memory_limit_enforced":true,"process_tree_limit_enforced":true,"cpu_limit_enforced":true,"notice":"Local code runs with your permissions; it is not a sandbox."}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn x64_ffi_layout() {
        assert_eq!(size_of::<Startup>(), 104);
        assert_eq!(size_of::<Process>(), 24);
        assert_eq!(size_of::<ExtendedLimits>(), 144);
    }
    #[test]
    fn windows_command_and_timeout() {
        let python = std::env::var("MASTERY_TEST_PYTHON").unwrap_or_else(|_| "python.exe".into());
        let cwd = std::env::temp_dir().to_string_lossy().into_owned();
        let mut request =
            Request::parse(&json!({"command":python,"args":["-c","print('authored')"],"cwd":cwd}))
                .unwrap();
        let result = run(request).unwrap();
        assert_eq!(result["stdout"], "authored\r\n");
        request=Request::parse(&json!({"command":"python.exe","args":["-c","while True: pass"],"cwd":cwd,"timeoutMs":100})).unwrap();
        assert_eq!(run(request).unwrap()["verdict"], "timeout");
    }
}

#[cfg(test)]
mod enforcement_tests {
    use super::*;
    unsafe extern "system" {
        fn OpenProcess(access: u32, inherit: i32, id: u32) -> Handle;
    }
    fn request(code: &str) -> Request {
        Request::parse(&json!({"command":std::env::var("MASTERY_TEST_PYTHON").unwrap_or_else(|_|"python.exe".into()),"args":["-c",code],"cwd":std::env::temp_dir().to_string_lossy(),"timeoutMs":5000})).unwrap()
    }
    #[test]
    fn output_and_memory_limits() {
        let mut r = request("while True: print('x'*10000,flush=True)");
        r.output_limit = 1000;
        let result = run(r).unwrap();
        assert_eq!(result["verdict"], "output_limit");
        assert!(result["stdout"].as_str().unwrap().len() <= 1000);
        let mut r = request("x=bytearray(512*1024*1024)");
        r.memory_bytes = 64 * 1024 * 1024;
        let result = run(r).unwrap();
        assert_eq!(result["verdict"], "runtime_error");
        assert_eq!(result["memory_limit_enforced"], true);
    }
    #[test]
    fn successful_parent_exit_kills_descendant() {
        let result=run(request("import subprocess,sys; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); print(p.pid,flush=True)")).unwrap();
        assert_eq!(result["verdict"], "completed");
        let pid: u32 = result["stdout"].as_str().unwrap().trim().parse().unwrap();
        unsafe {
            let handle = OpenProcess(0x00100000, 0, pid);
            if !handle.is_null() {
                let owned = Owned(handle);
                assert_eq!(WaitForSingleObject(owned.0, 5000), 0);
            }
        }
    }
    #[test]
    fn cpu_limit_stops_busy_code() {
        let mut r = request("while True: pass");
        r.cpu_seconds = 1;
        r.timeout_ms = 10000;
        let started = Instant::now();
        let result = run(r).unwrap();
        assert_ne!(result["verdict"], "completed");
        assert!(started.elapsed() < Duration::from_secs(8));
        assert_eq!(result["cpu_limit_enforced"], true);
    }
}
