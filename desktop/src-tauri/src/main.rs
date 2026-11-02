// DA-0 supervisor only. Repository operations remain in the JS prototype until
// a final native ownership implementation is validated under ADR 007.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    thread,
    time::{Duration, Instant},
};
mod auth;
mod lifecycle;
use lifecycle::Lifecycle;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

struct Supervisor(Mutex<Option<Child>>);
impl Supervisor {
    fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(b"shutdown\n");
                }
                let deadline = Instant::now() + Duration::from_secs(8);
                loop {
                    if matches!(child.try_wait(), Ok(Some(_))) {
                        break;
                    }
                    if Instant::now() > deadline {
                        #[cfg(windows)]
                        {
                            let _ = Command::new("taskkill")
                                .args(["/PID", &child.id().to_string(), "/T", "/F"])
                                .status();
                        }
                        let _ = child.kill();
                        let _ = child.wait();
                        break;
                    }
                    thread::sleep(Duration::from_millis(30));
                }
            }
        }
    }
}
impl Drop for Supervisor {
    fn drop(&mut self) {
        self.stop();
    }
}

fn environment_path(name: &str, fallback: PathBuf) -> PathBuf {
    std::env::var_os(name)
        .map(PathBuf::from)
        .unwrap_or(fallback)
}
fn bootstrap(
    node: &Path,
    script: &Path,
    root: &Path,
    data: &Path,
) -> Result<(Child, String), Box<dyn std::error::Error>> {
    let mut child = Command::new(node)
        .arg(script)
        .env("DESKTOP_SPIKE_ROOT", root)
        .env("DESKTOP_APP_DATA", data)
        .env("DESKTOP_CREDENTIAL_HELPER", std::env::current_exe()?)
        .env(
            "DESKTOP_PACKAGED",
            if cfg!(debug_assertions) { "0" } else { "1" },
        )
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let stdout = child.stdout.take().ok_or("prototype stdout unavailable")?;
    let (send, recv) = mpsc::channel();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if line.len() > 65536 {
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
                if value["type"] == "ready" {
                    let _ = send.send(value["url"].as_str().unwrap_or("").to_owned());
                    return;
                }
            }
        }
    });
    match recv.recv_timeout(Duration::from_secs(30)) {
        Ok(url) => Ok((child, url)),
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(Box::new(error))
        }
    }
}
fn credential_smoke() -> Result<(), Box<dyn std::error::Error>> {
    if !cfg!(any(target_os = "macos", target_os = "windows")) {
        return Err("OS credential store unsupported".into());
    }
    let id = format!(
        "da0-smoke-{}-{:?}",
        std::process::id(),
        std::time::SystemTime::now()
    );
    let entry = keyring::Entry::new("local.algorithm-mastery.da0.tauri", &id)?;
    entry.set_password("authored-da0-credential-fixture")?;
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        if entry.get_password()? != "authored-da0-credential-fixture" {
            return Err("credential mismatch".into());
        }
        entry.delete_credential()?;
        if !matches!(entry.get_password(), Err(keyring::Error::NoEntry)) {
            return Err("credential delete mismatch".into());
        }
        Ok(())
    })();
    let _ = entry.delete_credential();
    result
}
fn copy_existing(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
) -> Result<bool, Box<dyn std::error::Error>> {
    let (_, root, node, data) = candidate_paths(app)?;
    if app.state::<Lifecycle>().is_stopping() {
        return Ok(false);
    }
    let file = app
        .dialog()
        .file()
        .set_parent(window)
        .set_title("기존 학습 SQLite 선택")
        .add_filter("SQLite", &["sqlite3", "sqlite", "db"])
        .blocking_pick_file();
    if app.state::<Lifecycle>().is_stopping() {
        return Ok(false);
    }
    let Some(file) = file else { return Ok(false) };
    let path = file
        .into_path()
        .map_err(|_| "local database path required")?;
    let confirmed = app
        .dialog()
        .message("선택한 기록을 앱 데이터 폴더에 복사합니다. 원본 파일은 보존됩니다.")
        .title("학습 기록 복사 확인")
        .parent(window)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "복사".into(),
            "취소".into(),
        ))
        .blocking_show();
    if !confirmed || app.state::<Lifecycle>().is_stopping() {
        return Ok(false);
    }
    let mut child = Command::new(node)
        .arg(root.join("desktop/import.mjs"))
        .arg("--source")
        .arg(path)
        .arg("--app-data")
        .arg(data)
        .arg("--confirm")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if let Some(status) = child.try_wait()? {
            if !status.success() {
                return Err("learner copy failed".into());
            }
            return Ok(!app.state::<Lifecycle>().is_stopping());
        }
        if app.state::<Lifecycle>().is_stopping() || Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("learner copy cancelled or timed out".into());
        }
        thread::sleep(Duration::from_millis(30));
    }
}
#[tauri::command]
async fn first_run_choose(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    choice: String,
) -> Result<bool, String> {
    if window.label() != "onboarding" || !matches!(choice.as_str(), "new" | "copy" | "cancel") {
        return Err("invalid startup request".into());
    }
    if choice == "cancel" {
        app.state::<Lifecycle>().stop();
        app.exit(0);
        return Ok(false);
    }
    app.state::<Lifecycle>().begin().map_err(str::to_owned)?;
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<bool, String> {
        if choice == "copy"
            && !copy_existing(&handle, &window).map_err(|_| "learner copy failed")?
        {
            return Ok(false);
        }
        if handle.state::<Lifecycle>().is_stopping() {
            return Ok(false);
        }
        launch(&handle).map_err(|_| "startup failed")?;
        if handle.state::<Lifecycle>().is_stopping() {
            if let Some(supervisor) = handle.try_state::<Supervisor>() {
                supervisor.stop();
            }
            return Ok(false);
        }
        // Destroy bypasses a user CloseRequested event: the new main window now owns the app.
        window
            .destroy()
            .map_err(|_| "could not close startup window")?;
        Ok(true)
    })
    .await
    .map_err(|_| "startup worker failed".to_owned());
    app.state::<Lifecycle>().finish();
    result?
}
/// Repository folders come from a native picker so learners never type absolute paths.
#[tauri::command]
async fn pick_folder(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    if window.label() != "main" {
        return Err("unsupported window".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_parent(&window)
            .set_title("폴더 선택")
            .blocking_pick_folder()
            .and_then(|folder| folder.into_path().ok())
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| "folder picker failed".to_owned())
}
// Keep native traffic lights and the standard content inset. A transparent native
// title bar reveals the window's neutral surface; this is not an HTML toolbar.
#[tauri::command]
fn set_appearance(window: tauri::WebviewWindow, appearance: String) -> Result<(), String> {
    if window.label() != "main" {
        return Err("unsupported window".into());
    }
    let theme = match appearance.as_str() {
        "system" => None,
        "light" => Some(tauri::Theme::Light),
        "dark" => Some(tauri::Theme::Dark),
        _ => return Err("invalid appearance".into()),
    };
    window.set_theme(theme).map_err(|e| e.to_string())?;
    let dark = matches!(
        theme.or_else(|| window.theme().ok()),
        Some(tauri::Theme::Dark)
    );
    window
        .set_background_color(Some(if dark {
            tauri::window::Color(38, 38, 40, 255)
        } else {
            tauri::window::Color(229, 229, 229, 255)
        }))
        .map_err(|e| e.to_string())?;
    if std::env::var("DESKTOP_SPIKE_SMOKE").ok().as_deref() == Some("1") {
        println!(
            "{}",
            serde_json::json!({"type":"appearance-applied","mode":appearance,"dark":dark})
        );
    }
    Ok(())
}

fn native_window_chrome<'a, M: Manager<tauri::Wry>>(
    builder: WebviewWindowBuilder<'a, tauri::Wry, M>,
) -> WebviewWindowBuilder<'a, tauri::Wry, M> {
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Transparent);
    builder
}

fn show_onboarding(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.add_capability(
        tauri::ipc::CapabilityBuilder::new("startup-local-only")
            .window("onboarding")
            .local(true)
            .permission("allow-first-run-choose"),
    )?;
    native_window_chrome(WebviewWindowBuilder::new(
        app,
        "onboarding",
        WebviewUrl::App("onboarding.html".into()),
    ))
    .title("ALDY · 학습 기록 시작")
    .inner_size(510.0, 470.0)
    .resizable(false)
    .on_navigation(|url| url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost"))
    .on_page_load(|window, payload| {
        if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
            println!(
                "{}",
                serde_json::json!({"type":"onboarding-ready","pid":std::process::id()})
            );
            match std::env::var("DESKTOP_ONBOARDING_SMOKE").ok().as_deref() {
                Some("close") => {
                    let _ = window.close();
                }
                Some("cancel") => {
                    let _ = window.eval("document.getElementById('cancel').click()");
                }
                Some("new") => {
                    let _ = window.eval("document.getElementById('new').click()");
                }
                _ => {}
            }
        }
    })
    .build()?;
    Ok(())
}
fn candidate_paths(
    app: &tauri::AppHandle,
) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), Box<dyn std::error::Error>> {
    let resources = app.path().resource_dir()?;
    let root = environment_path(
        "DESKTOP_SPIKE_ROOT",
        if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
        } else {
            resources.join("prototype")
        },
    );
    let node = environment_path(
        "DESKTOP_SPIKE_NODE",
        resources
            .join("runtime-node")
            .join(if cfg!(windows) { "node.exe" } else { "node" }),
    );
    let data = environment_path("DESKTOP_APP_DATA", app.path().app_data_dir()?);
    Ok((resources, root, node, data))
}
fn external_link_allowed(url: &url::Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && matches!(
            url.host_str(),
            Some(
                "github.com"
                    | "leetcode.com"
                    | "www.leetcode.com"
                    | "codeforces.com"
                    | "www.codeforces.com"
                    | "atcoder.jp"
            )
        )
}
fn open_external(url: &url::Url) -> bool {
    if !external_link_allowed(url) {
        return false;
    }
    #[cfg(target_os = "macos")]
    let opened = Command::new("open").arg(url.as_str()).spawn().is_ok();
    #[cfg(windows)]
    let opened = Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", url.as_str()])
        .spawn()
        .is_ok();
    #[cfg(not(any(target_os = "macos", windows)))]
    let opened = false;
    opened
}
fn launch(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if app.state::<Lifecycle>().is_stopping() {
        return Err("application is closing".into());
    }
    let resources = app.path().resource_dir()?;
    let root = environment_path(
        "DESKTOP_SPIKE_ROOT",
        if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
        } else {
            resources.join("prototype")
        },
    );
    let node = environment_path(
        "DESKTOP_SPIKE_NODE",
        resources
            .join("runtime-node")
            .join(if cfg!(windows) { "node.exe" } else { "node" }),
    );
    let script = if cfg!(debug_assertions) {
        root.join("desktop/runtime/bootstrap.mjs")
    } else {
        resources.join("runtime/bootstrap.mjs")
    };
    let data = environment_path("DESKTOP_APP_DATA", app.path().app_data_dir()?);
    if !cfg!(debug_assertions) {
        if std::env::var_os("DESKTOP_CATALOG_ROOT").is_none() {
            std::env::set_var("DESKTOP_CATALOG_ROOT", resources.join("datasets"));
        }
        if std::env::var_os("DESKTOP_COMPANY_ROOT").is_none() {
            std::env::set_var("DESKTOP_COMPANY_ROOT", resources.join("datasets"));
        }
    }
    let (child, address) = bootstrap(&node, &script, &root, &data)?;
    let adapter_pid = child.id();
    if app.state::<Lifecycle>().is_stopping() {
        Supervisor(Mutex::new(Some(child))).stop();
        return Err("application is closing".into());
    }
    let supervisor = Supervisor(Mutex::new(Some(child)));
    let url = url::Url::parse(&address)?;
    if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") {
        supervisor.stop();
        return Err("invalid prototype URL".into());
    }
    let origin = url.origin();
    let ready_address = address.clone();
    let handle = app.clone();
    app.manage(supervisor);
    app.manage(auth::AuthState::new(origin.ascii_serialization()));
    app.add_capability(
        tauri::ipc::CapabilityBuilder::new("native-auth-only")
            .window("main")
            .local(false)
            .remote(format!("{}/*", origin.ascii_serialization()))
            .permission("allow-auth-begin")
            .permission("allow-auth-complete")
            .permission("allow-auth-status")
            .permission("allow-auth-sign-out")
            .permission("allow-da0-probe")
            .permission("allow-set-appearance")
            .permission("allow-pick-folder")
            .permission("allow-github-repositories")
            .permission("allow-github-create-repository"),
    )?;
    native_window_chrome(WebviewWindowBuilder::new(app,"main",WebviewUrl::External(url))).title("ALDY — Algorithm Daily")
            .inner_size(1440.0,1000.0).on_new_window(|url,_| {
                let _=open_external(&url);
                tauri::webview::NewWindowResponse::Deny
            }).initialization_script(String::from("if(window===window.top){const invoke=window.__TAURI_INTERNALS__.invoke;document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>invoke('da0_probe',{input:{title:document.title,bridge:typeof window.algorithmNativeAuth==='object',signin_disabled:document.querySelector('#github-sign-in')?.disabled??true,auth_status:document.querySelector('#github-status')?.textContent??''}}).catch(()=>{}),300));Object.defineProperty(window,'algorithmNativeAuth',{value:Object.freeze({begin:input=>invoke('auth_begin',{input}),complete:input=>invoke('auth_complete',{input}),status:()=>invoke('auth_status'),signOut:()=>invoke('auth_sign_out'),appearance:appearance=>invoke('set_appearance',{appearance}),pickFolder:()=>invoke('pick_folder'),githubRepositories:()=>invoke('github_repositories'),githubCreateRepository:input=>invoke('github_create_repository',{input}),githubClientId:")+&serde_json::to_string(&option_env!("ALDY_GITHUB_CLIENT_ID")).unwrap()+"})});}").on_page_load(move |_,payload| {
                if matches!(payload.event(),tauri::webview::PageLoadEvent::Finished) {
                    println!("{}",serde_json::json!({"type":"shell-ready","candidate":"tauri","shell_pid":std::process::id(),"adapter_pid":adapter_pid,"url":ready_address}));
                    if std::env::var("DESKTOP_SPIKE_SMOKE").ok().as_deref()==Some("1") || std::env::var("DESKTOP_ONBOARDING_SMOKE").ok().as_deref()==Some("new") {
                        let handle=handle.clone();thread::spawn(move ||{let hold=std::env::var("DESKTOP_SPIKE_HOLD_MS").ok().and_then(|s|s.parse::<u64>().ok()).unwrap_or(800).clamp(800,300000);thread::sleep(Duration::from_millis(hold));handle.exit(0);});
                    }
                }
            }).on_navigation(move |next| {
                // WebKit asks this handler before createWebView for target=_blank links, so
                // allowlisted external pages must be handed to the OS browser here.
                if next.origin()==origin {return true;}
                let _=open_external(next);
                false
            }).build()?;
    Ok(())
}
fn main() {
    if std::env::args().any(|arg| arg == "--credential-read") {
        match keyring::Entry::new("local.algorithm-mastery.da0.tauri", "github")
            .and_then(|entry| entry.get_password())
        {
            Ok(value)
                if !value.is_empty() && value.len() < 16384 && !value.contains(['\r', '\n']) =>
            {
                print!("{value}");
                return;
            }
            Err(keyring::Error::NoEntry) => std::process::exit(1),
            _ => std::process::exit(2),
        }
    }
    if std::env::args().any(|arg| arg == "--credential-smoke") {
        match credential_smoke() {Ok(())=>println!("{{\"type\":\"credential-smoke\",\"candidate\":\"tauri\",\"write\":true,\"read\":true,\"delete\":true}}"),Err(_)=>{eprintln!("OS credential smoke failed");std::process::exit(1);}}
        return;
    }
    let app = tauri::Builder::default()
        .manage(Lifecycle::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            auth::auth_begin,
            auth::auth_complete,
            auth::auth_status,
            auth::auth_sign_out,
            auth::github_repositories,
            auth::github_create_repository,
            auth::da0_probe,
            set_appearance,
            pick_folder,
            first_run_choose
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                window.state::<Lifecycle>().stop();
                window.app_handle().exit(0);
            }
        })
        .setup(|app| {
            let (_, _, _, data) = candidate_paths(app.handle())?;
            if !data.join("learner.sqlite3").exists()
                && std::env::var("DESKTOP_SPIKE_SMOKE").ok().as_deref() != Some("1")
            {
                show_onboarding(app.handle())
            } else {
                launch(app.handle())
            }
        })
        .build(tauri::generate_context!())
        .expect("DA-0 candidate setup failed");
    app.run(|handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            handle.state::<Lifecycle>().stop();
            if let Some(supervisor) = handle.try_state::<Supervisor>() {
                supervisor.stop();
            }
        }
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_supervisor_stops_idempotently() {
        let supervisor = Supervisor(Mutex::new(None));
        supervisor.stop();
        supervisor.stop();
    }
    #[test]
    fn explicit_path_preserves_special_characters() {
        let path = PathBuf::from("folder 한 # %/runtime-node/node");
        assert_eq!(environment_path("UNSET_DA0_TEST_PATH", path.clone()), path);
    }
    #[test]
    fn external_links_are_https_allowlisted() {
        let ok = |s: &str| external_link_allowed(&url::Url::parse(s).unwrap());
        assert!(ok("https://leetcode.com/problems/two-sum/"));
        assert!(ok("https://codeforces.com/contest/4/problem/A"));
        assert!(ok("https://atcoder.jp/contests/abc300/tasks/abc300_a"));
        assert!(!ok("http://leetcode.com/problems/two-sum/"));
        assert!(!ok("https://user:pw@leetcode.com/"));
        assert!(!ok("https://leetcode.com.evil.test/"));
        assert!(!ok("https://leetcode.com:8443/"));
        assert!(!ok("file:///etc/passwd"));
    }
}
