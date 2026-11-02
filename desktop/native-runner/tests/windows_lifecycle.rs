#![cfg(windows)]
use serde_json::json;
use std::{
    ffi::c_void,
    fs,
    io::Write,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
#[link(name = "kernel32")]
unsafe extern "system" {
    fn OpenProcess(access: u32, inherit: i32, id: u32) -> *mut c_void;
    fn WaitForSingleObject(handle: *mut c_void, milliseconds: u32) -> u32;
    fn CloseHandle(handle: *mut c_void) -> i32;
}
#[test]
fn helper_crash_closes_job_and_kills_user_process() {
    let marker = std::env::temp_dir().join(format!(
        "mastery-native-lifecycle-{}.txt",
        std::process::id()
    ));
    let _ = fs::remove_file(&marker);
    let python = std::env::var("MASTERY_TEST_PYTHON").unwrap_or_else(|_| "python.exe".into());
    let code = "import os,sys,time; open(sys.argv[1],'w').write(str(os.getpid())); time.sleep(60)";
    let mut child = Command::new(env!("CARGO_BIN_EXE_mastery-native-runner"))
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let payload = json!({"command":python,"args":["-c",code,marker.to_string_lossy()],"cwd":std::env::temp_dir().to_string_lossy(),"timeoutMs":60000});
    child
        .stdin
        .take()
        .unwrap()
        .write_all(payload.to_string().as_bytes())
        .unwrap();
    let started = Instant::now();
    while !marker.exists() && started.elapsed() < Duration::from_secs(10) {
        thread::sleep(Duration::from_millis(20));
    }
    if !marker.exists() {
        let _ = child.kill();
        let _ = child.wait();
        panic!("user process did not start");
    }
    // Ensure the marker's write has completed before parsing it.
    let pid = loop {
        if let Ok(value) = fs::read_to_string(&marker) {
            if let Ok(pid) = value.parse::<u32>() {
                break pid;
            }
        }
        assert!(started.elapsed() < Duration::from_secs(10));
        thread::sleep(Duration::from_millis(10));
    };
    child.kill().unwrap();
    child.wait().unwrap();
    unsafe {
        let handle = OpenProcess(0x00100000, 0, pid);
        if !handle.is_null() {
            let result = WaitForSingleObject(handle, 5000);
            CloseHandle(handle);
            assert_eq!(
                result, 0,
                "helper death must close its Job and terminate user process"
            );
        }
    }
    fs::remove_file(marker).unwrap();
}
