// Native GitHub device flow. Renderer receives only public codes and opaque handles.
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::State;

struct Device {
    code: String,
    client_id: String,
    expires: Instant,
    interval: u64,
    generation: u64,
}
pub struct AuthState {
    pub origin: String,
    flows: Mutex<HashMap<String, Device>>,
    generation: AtomicU64,
    write_lock: tokio::sync::Mutex<()>,
}
impl AuthState {
    pub fn new(origin: String) -> Self {
        Self {
            origin,
            flows: Mutex::new(HashMap::new()),
            generation: AtomicU64::new(0),
            write_lock: tokio::sync::Mutex::new(()),
        }
    }
}
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("local.algorithm-mastery.da0.tauri", "github")
        .map_err(|_| "OS credential store unavailable".into())
}
fn check(window: &tauri::WebviewWindow, state: &AuthState) -> Result<(), String> {
    if window.label() != "main"
        || window
            .url()
            .map_err(|_| "invalid window")?
            .origin()
            .ascii_serialization()
            != state.origin
    {
        return Err("native authentication request denied".into());
    }
    Ok(())
}
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "GitHub authentication unavailable".into())
}
async fn post(path: &str, body: Value) -> Result<Value, String> {
    let response = client()?
        .post(format!("https://github.com{path}"))
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|_| "GitHub authentication unavailable")?;
    if !response.status().is_success() {
        return Err("GitHub authentication unavailable".into());
    }
    let text = response
        .text()
        .await
        .map_err(|_| "GitHub authentication unavailable")?;
    if text.len() > 65536 {
        return Err("invalid authentication response".into());
    }
    serde_json::from_str(&text).map_err(|_| "invalid authentication response".into())
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Begin {
    client_id: String,
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Complete {
    flow_id: String,
}
fn valid_client(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
}
#[tauri::command]
pub async fn auth_begin(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
    input: Begin,
) -> Result<Value, String> {
    check(&window, &state)?;
    if !valid_client(&input.client_id) {
        return Err("invalid GitHub App Client ID".into());
    }
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    state
        .flows
        .lock()
        .map_err(|_| "authentication state unavailable")?
        .clear();
    // OAuth Apps need `repo` for private solution repositories; GitHub Apps ignore the scope.
    let response = post("/login/device/code", json!({"client_id":input.client_id,"scope":"repo"})).await?;
    let code = response["device_code"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("invalid device response")?
        .to_string();
    let user_code = response["user_code"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("invalid device response")?;
    let uri = response["verification_uri"]
        .as_str()
        .ok_or("invalid device response")?;
    let url = url::Url::parse(uri).map_err(|_| "invalid verification URL")?;
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("invalid verification URL".into());
    }
    let expires = response["expires_in"]
        .as_u64()
        .filter(|s| *s > 0 && *s <= 3600)
        .ok_or("invalid device response")?;
    let interval = response["interval"].as_u64().unwrap_or(5).clamp(1, 60);
    let flow_id = uuid::Uuid::new_v4().to_string();
    if state.generation.load(Ordering::SeqCst) != generation {
        return Err("authentication cancelled".into());
    }
    state
        .flows
        .lock()
        .map_err(|_| "authentication state unavailable")?
        .insert(
            flow_id.clone(),
            Device {
                code,
                client_id: input.client_id,
                expires: Instant::now() + Duration::from_secs(expires),
                interval,
                generation,
            },
        );
    Ok(
        json!({"flowId":flow_id,"user_code":user_code,"verification_uri":url.as_str(),"expires_in":expires,"interval":interval}),
    )
}
#[tauri::command]
pub async fn auth_complete(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
    input: Complete,
) -> Result<Value, String> {
    check(&window, &state)?;
    let mut flow = state
        .flows
        .lock()
        .map_err(|_| "authentication state unavailable")?
        .remove(&input.flow_id)
        .ok_or("invalid authentication flow")?;
    while Instant::now() < flow.expires {
        if state.generation.load(Ordering::SeqCst) != flow.generation {
            return Err("authentication cancelled".into());
        }
        tokio::time::sleep(Duration::from_secs(flow.interval)).await;
        if Instant::now() >= flow.expires {
            return Err("expired_token".into());
        }
        let response=post("/login/oauth/access_token",json!({"client_id":flow.client_id,"device_code":flow.code,"grant_type":"urn:ietf:params:oauth:grant-type:device_code"})).await?;
        if let Some(token) = response["access_token"].as_str().filter(|s| !s.is_empty()) {
            let _guard = state.write_lock.lock().await;
            if state.generation.load(Ordering::SeqCst) != flow.generation {
                return Err("authentication cancelled".into());
            }
            entry()?
                .set_password(token)
                .map_err(|_| "OS credential write failed")?;
            return Ok(json!({"signedIn":true}));
        }
        match response["error"].as_str() {
            Some("authorization_pending") => {}
            Some("slow_down") => flow.interval += 5,
            Some("access_denied") => return Err("access_denied".into()),
            Some("expired_token") => return Err("expired_token".into()),
            _ => return Err("GitHub authentication failed".into()),
        }
    }
    Err("expired_token".into())
}
#[tauri::command]
pub async fn auth_status(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
) -> Result<Value, String> {
    check(&window, &state)?;
    let _guard = state.write_lock.lock().await;
    match entry()?.get_password() {
        Ok(_) => Ok(json!({"signedIn":true})),
        Err(keyring::Error::NoEntry) => Ok(json!({"signedIn":false})),
        Err(_) => Err("OS credential read unavailable".into()),
    }
}
#[tauri::command]
pub async fn auth_sign_out(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
) -> Result<Value, String> {
    check(&window, &state)?;
    state.generation.fetch_add(1, Ordering::SeqCst);
    state
        .flows
        .lock()
        .map_err(|_| "authentication state unavailable")?
        .clear();
    let _guard = state.write_lock.lock().await;
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(json!({"signedIn":false})),
        Err(_) => Err("OS credential delete unavailable".into()),
    }
}
// Repository metadata only: the token stays in the credential store and never reaches the renderer (NW-4).
async fn api(method: reqwest::Method, path: &str, body: Option<Value>) -> Result<Value, String> {
    let token = match entry()?.get_password() {
        Ok(token) => token,
        Err(keyring::Error::NoEntry) => return Err("GitHub에 먼저 로그인하세요.".into()),
        Err(_) => return Err("OS credential read unavailable".into()),
    };
    let mut request = client()?
        .request(method, format!("https://api.github.com{path}"))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", "ALDY-desktop")
        .bearer_auth(token);
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request.send().await.map_err(|_| "GitHub unavailable")?;
    let status = response.status();
    let text = response.text().await.map_err(|_| "GitHub unavailable")?;
    if text.len() > 4 * 1024 * 1024 {
        return Err("GitHub response too large".into());
    }
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err("GitHub 로그인이 만료되었습니다. 다시 로그인하세요.".into());
    }
    if status == reqwest::StatusCode::UNPROCESSABLE_ENTITY {
        return Err("같은 이름의 저장소가 이미 있거나 이름을 쓸 수 없습니다.".into());
    }
    if !status.is_success() {
        return Err(format!("GitHub request failed ({})", status.as_u16()));
    }
    serde_json::from_str(&text).map_err(|_| "invalid GitHub response".into())
}
fn repository_summary(value: &Value) -> Option<Value> {
    let clone_url = value["clone_url"].as_str()?;
    let url = url::Url::parse(clone_url).ok()?;
    if url.scheme() != "https" || url.host_str() != Some("github.com") {
        return None;
    }
    Some(json!({"fullName":value["full_name"].as_str()?,"name":value["name"].as_str()?,"cloneUrl":clone_url,"private":value["private"].as_bool().unwrap_or(false),"updatedAt":value["updated_at"].as_str().unwrap_or("")}))
}
fn valid_repository_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value != "."
        && value != ".."
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
}
#[tauri::command]
pub async fn github_repositories(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
) -> Result<Value, String> {
    check(&window, &state)?;
    let user = api(reqwest::Method::GET, "/user", None).await?;
    let list = api(
        reqwest::Method::GET,
        "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
        None,
    )
    .await?;
    let repositories: Vec<Value> = list
        .as_array()
        .ok_or("invalid GitHub response")?
        .iter()
        .filter_map(repository_summary)
        .collect();
    Ok(json!({"login":user["login"].as_str().unwrap_or(""),"repositories":repositories}))
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateRepository {
    name: String,
    private: bool,
}
#[tauri::command]
pub async fn github_create_repository(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
    input: CreateRepository,
) -> Result<Value, String> {
    check(&window, &state)?;
    if !valid_repository_name(&input.name) {
        return Err("저장소 이름은 영문, 숫자, -, _, . 만 쓸 수 있습니다.".into());
    }
    let created = api(
        reqwest::Method::POST,
        "/user/repos",
        Some(json!({"name":input.name,"private":input.private,"description":"ALDY algorithm solutions","auto_init":false})),
    )
    .await?;
    repository_summary(&created).ok_or_else(|| "invalid GitHub response".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn client_id_is_bounded() {
        assert!(valid_client("Iv1.fixture"));
        assert!(!valid_client("bad client"));
        assert!(!valid_client(&"a".repeat(121)));
    }
    #[test]
    fn repository_names_are_bounded() {
        assert!(valid_repository_name("algorithm-solution"));
        assert!(!valid_repository_name(".."));
        assert!(!valid_repository_name("bad/name"));
        assert!(!valid_repository_name(&"a".repeat(101)));
    }
    #[test]
    fn repository_summaries_require_github_https() {
        let ok = json!({"full_name":"me/a","name":"a","clone_url":"https://github.com/me/a.git","private":true});
        assert_eq!(repository_summary(&ok).unwrap()["private"], true);
        let bad = json!({"full_name":"me/a","name":"a","clone_url":"http://evil.invalid/a.git"});
        assert!(repository_summary(&bad).is_none());
    }
}

#[tauri::command]
pub fn da0_probe(
    window: tauri::WebviewWindow,
    state: State<'_, AuthState>,
    input: Value,
) -> Result<(), String> {
    check(&window, &state)?;
    if std::env::var("DESKTOP_SPIKE_SMOKE").ok().as_deref() != Some("1") {
        return Err("probe disabled".into());
    }
    let text = |key: &str| {
        input[key]
            .as_str()
            .unwrap_or("")
            .chars()
            .take(200)
            .collect::<String>()
    };
    println!(
        "{}",
        json!({"type":"ui-smoke","candidate":"tauri","title":text("title"),"bridge":input["bridge"].as_bool().unwrap_or(false),"signin_disabled":input["signin_disabled"].as_bool().unwrap_or(true),"auth_status":text("auth_status")})
    );
    Ok(())
}
